from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.config import Settings
from app.core.db import get_db
from app.core.deps import (
    client_ip,
    current_auth,
    enforce_limit,
    get_app_settings,
    get_limiter,
    get_mailer,
)
from app.core.rate_limit import RateLimiter
from app.schemas.auth import (
    LoginIn,
    PasswordResetConfirmIn,
    PasswordResetRequestIn,
    RegisterIn,
    SessionOut,
)
from app.services import auth as svc
from app.services.auth import AuthContext
from app.services.mailer import Mailer

router = APIRouter(prefix="/api/v1/auth", tags=["autenticação"])


def set_session_cookie(response: Response, settings: Settings, token: str) -> None:
    response.set_cookie(
        settings.session_cookie_name,
        token,
        max_age=settings.session_absolute_days * 86400,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        path="/",
    )


def session_out(db: Session, ctx: AuthContext) -> SessionOut:
    prefs = svc.get_preferences(db, ctx.user)
    db.refresh(prefs)
    return SessionOut.model_validate(
        {"user": ctx.user, "preferences": prefs, "csrf_token": ctx.session.csrf_token}
    )


@router.post("/register", response_model=SessionOut, status_code=201)
def register(
    body: RegisterIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    ip = client_ip(request) or "?"
    enforce_limit(limiter, settings, f"register:ip:{ip}", settings.rate_limit_register_ip)
    token, ctx = svc.register(
        db, settings, email=body.email, password=body.password,
        display_name=body.display_name, ip=client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )
    set_session_cookie(response, settings, token)
    return session_out(db, ctx)


@router.post("/login", response_model=SessionOut)
def login(
    body: LoginIn,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    ip = client_ip(request) or "?"
    email = svc.normalize_email(body.email)
    pair_key = f"login:pair:{email}:{ip}"
    enforce_limit(limiter, settings, f"login:ip:{ip}", settings.rate_limit_login_ip)
    enforce_limit(limiter, settings, f"login:email:{email}", settings.rate_limit_login_email)
    enforce_limit(limiter, settings, pair_key, settings.rate_limit_login_pair)
    token, ctx = svc.login(
        db, settings, email=body.email, password=body.password,
        ip=client_ip(request), user_agent=request.headers.get("user-agent"),
    )
    limiter.reset(pair_key)
    set_session_cookie(response, settings, token)
    return session_out(db, ctx)


@router.post("/logout", status_code=204)
def logout(
    response: Response,
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    svc.logout(db, ctx.session)
    response.delete_cookie(settings.session_cookie_name, path="/")


@router.post("/password-reset/request", status_code=202)
def password_reset_request(
    body: PasswordResetRequestIn,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
    mailer: Mailer = Depends(get_mailer),
):
    ip = client_ip(request) or "?"
    enforce_limit(limiter, settings, f"reset:ip:{ip}", settings.rate_limit_reset_ip)
    enforce_limit(limiter, settings, f"reset:email:{svc.normalize_email(body.email)}", 3)
    svc.request_password_reset(db, settings, mailer, body.email)
    # Resposta idêntica exista ou não a conta (evita enumeração de e-mails).
    return {"detail": "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação."}


@router.post("/password-reset/confirm", status_code=204)
def password_reset_confirm(
    body: PasswordResetConfirmIn,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    ip = client_ip(request) or "?"
    enforce_limit(limiter, settings, f"reset:ip:{ip}", settings.rate_limit_reset_ip)
    svc.confirm_password_reset(db, token=body.token, new_password=body.new_password)
