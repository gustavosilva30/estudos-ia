import ipaddress
import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.core import security
from app.core.errors import AppError, Forbidden, Unauthorized
from app.models import PasswordReset, User, UserPreference, UserSession
from app.services.mailer import Mailer

log = logging.getLogger("estudos.auth")

TOUCH_INTERVAL = timedelta(minutes=5)


@dataclass
class AuthContext:
    user: User
    session: UserSession


def _now() -> datetime:
    return datetime.now(UTC)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def _create_session(
    db: Session, settings: Settings, user: User, ip: str | None, user_agent: str | None
) -> tuple[str, UserSession]:
    token = security.new_token()
    now = _now()
    try:
        ip = str(ipaddress.ip_address(ip)) if ip else None
    except ValueError:  # host não é um IP (ex.: socket Unix)
        ip = None
    session = UserSession(
        user_id=user.id,
        token_hash=security.hash_token(token),
        csrf_token=security.new_token(),
        ip_address=ip,
        user_agent=(user_agent or "")[:255] or None,
        expires_at=now + timedelta(hours=settings.session_ttl_hours),
    )
    db.add(session)
    db.flush()
    return token, session


def register(
    db: Session, settings: Settings, *, email: str, password: str, display_name: str | None,
    ip: str | None, user_agent: str | None,
) -> tuple[str, AuthContext]:
    if not settings.registration_enabled:
        raise Forbidden("O cadastro de novos usuários está desativado.")
    email = normalize_email(email)
    user = User(email=email, password_hash=security.hash_password(password), display_name=display_name)
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise AppError(409, "Já existe uma conta com este e-mail.") from None
    db.add(UserPreference(user_id=user.id))
    token, session = _create_session(db, settings, user, ip, user_agent)
    db.commit()
    log.info("usuario_cadastrado user_id=%s", user.id)
    return token, AuthContext(user, session)


def login(
    db: Session, settings: Settings, *, email: str, password: str,
    ip: str | None, user_agent: str | None,
) -> tuple[str, AuthContext]:
    user = db.scalar(select(User).where(func.lower(User.email) == normalize_email(email)))
    # Mesma mensagem e mesmo custo de tempo para e-mail inexistente, senha errada ou conta inativa.
    if user is None or not user.is_active:
        security.verify_dummy(password)
        raise Unauthorized("E-mail ou senha incorretos.")
    if not security.verify_password(user.password_hash, password):
        raise Unauthorized("E-mail ou senha incorretos.")
    if security.needs_rehash(user.password_hash):
        user.password_hash = security.hash_password(password)
    token, session = _create_session(db, settings, user, ip, user_agent)
    db.commit()
    log.info("login user_id=%s", user.id)
    return token, AuthContext(user, session)


def authenticate(db: Session, settings: Settings, token: str | None) -> AuthContext:
    """Resolve o usuário a partir do cookie de sessão. Única fonte de identidade."""
    if not token:
        raise Unauthorized()
    now = _now()
    row = db.execute(
        select(UserSession, User)
        .join(User, User.id == UserSession.user_id)
        .where(
            UserSession.token_hash == security.hash_token(token),
            UserSession.expires_at > now,
            User.is_active.is_(True),
        )
    ).first()
    if row is None:
        raise Unauthorized("Sessão inválida ou expirada.")
    session, user = row
    if now - session.last_seen_at > TOUCH_INTERVAL:  # expiração deslizante, com teto absoluto
        limit = session.created_at + timedelta(days=settings.session_absolute_days)
        session.last_seen_at = now
        session.expires_at = min(now + timedelta(hours=settings.session_ttl_hours), limit)
        db.commit()
    return AuthContext(user, session)


def logout(db: Session, session: UserSession) -> None:
    db.execute(delete(UserSession).where(UserSession.id == session.id))
    db.commit()


def request_password_reset(db: Session, settings: Settings, mailer: Mailer, email: str) -> None:
    """Nunca revela se o e-mail existe: o chamador sempre responde igual."""
    user = db.scalar(select(User).where(func.lower(User.email) == normalize_email(email)))
    if user is None or not user.is_active:
        return
    token = security.new_token()
    db.add(
        PasswordReset(
            user_id=user.id,
            token_hash=security.hash_token(token),
            expires_at=_now() + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    db.commit()
    mailer.send_password_reset(user.email, token)


def confirm_password_reset(db: Session, *, token: str, new_password: str) -> None:
    now = _now()
    reset = db.scalar(
        select(PasswordReset)
        .where(
            PasswordReset.token_hash == security.hash_token(token),
            PasswordReset.used_at.is_(None),
            PasswordReset.expires_at > now,
        )
        .with_for_update()
    )
    if reset is None:
        raise AppError(400, "Link de recuperação inválido ou expirado.")
    user = db.get(User, reset.user_id)
    user.password_hash = security.hash_password(new_password)
    reset.used_at = now
    # Invalida todas as sessões e quaisquer outros links pendentes.
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.execute(
        update(PasswordReset)
        .where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None))
        .values(used_at=now)
    )
    db.commit()
    log.info("senha_redefinida user_id=%s", user.id)


def change_password(db: Session, ctx: AuthContext, *, current_password: str, new_password: str) -> None:
    if not security.verify_password(ctx.user.password_hash, current_password):
        raise AppError(400, "A senha atual está incorreta.")
    ctx.user.password_hash = security.hash_password(new_password)
    # Encerra as outras sessões; mantém a atual.
    db.execute(
        delete(UserSession).where(
            UserSession.user_id == ctx.user.id, UserSession.id != ctx.session.id
        )
    )
    db.commit()


def delete_account(db: Session, ctx: AuthContext, *, password: str) -> None:
    if not security.verify_password(ctx.user.password_hash, password):
        raise AppError(400, "A senha está incorreta.")
    user_id: uuid.UUID = ctx.user.id
    db.delete(ctx.user)  # cascata no banco apaga todos os dados do usuário
    db.commit()
    log.info("conta_excluida user_id=%s", user_id)


def get_preferences(db: Session, user: User) -> UserPreference:
    prefs = db.get(UserPreference, user.id)
    if prefs is None:
        prefs = UserPreference(user_id=user.id)
        db.add(prefs)
        db.flush()
    return prefs
