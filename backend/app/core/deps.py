"""Dependências de autenticação/autorização usadas pelos endpoints protegidos."""

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.config import Settings
from app.core import security
from app.core.db import get_db
from app.core.errors import Forbidden, TooManyRequests
from app.core.rate_limit import RateLimiter
from app.services import auth as auth_service
from app.services.auth import AuthContext
from app.services.mailer import Mailer

UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


def get_limiter(request: Request) -> RateLimiter:
    return request.app.state.limiter


def get_mailer(request: Request) -> Mailer:
    return request.app.state.mailer


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def enforce_limit(
    limiter: RateLimiter, settings: Settings, key: str, limit: int
) -> None:
    window = settings.rate_limit_window_seconds
    if not limiter.allow(key, limit, window):
        raise TooManyRequests(window)


def current_auth(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
) -> AuthContext:
    """Identidade vem SOMENTE do cookie de sessão; nunca de um user_id enviado pelo cliente."""
    token = request.cookies.get(settings.session_cookie_name)
    ctx = auth_service.authenticate(db, settings, token)
    if request.method in UNSAFE_METHODS:
        sent = request.headers.get("x-csrf-token", "")
        if not sent or not security.safe_equal(sent, ctx.session.csrf_token):
            raise Forbidden("Token CSRF ausente ou inválido.")
    return ctx


def require_role(*roles: str):
    """Preparação para níveis de acesso: Depends(require_role("admin"))."""

    def checker(ctx: AuthContext = Depends(current_auth)) -> AuthContext:
        if ctx.user.role not in roles:
            raise Forbidden()
        return ctx

    return checker
