import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.ai.providers import build_provider
from app.api.v1 import ai as ai_api
from app.api.v1 import attachments as attachments_api
from app.api.v1 import auth as auth_api
from app.api.v1 import dashboard as dashboard_api
from app.api.v1 import lessons as lessons_api
from app.api.v1 import search as search_api
from app.api.v1 import subjects as subjects_api
from app.api.v1 import summaries as summaries_api
from app.api.v1 import users as users_api
from app.config import Settings, get_settings
from app.core.deps import UNSAFE_METHODS
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.services.mailer import ConsoleMailer

log = logging.getLogger("estudos")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
    "Cache-Control": "no-store",
}


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    # Documentação interativa apenas fora de produção.
    docs = not settings.is_production
    app = FastAPI(
        title="Estudos IA",
        docs_url="/api/docs" if docs else None,
        redoc_url=None,
        openapi_url="/api/openapi.json" if docs else None,
    )
    app.state.settings = settings
    app.state.limiter = RateLimiter()
    app.state.mailer = ConsoleMailer(settings)
    app.state.provider = build_provider(settings)  # falha na partida se AI_PROVIDER for inválido

    @app.middleware("http")
    async def protections(request: Request, call_next):
        length = request.headers.get("content-length")
        # Só o envio de imagem aceita corpo maior (multipart tem uma pequena sobra além do arquivo).
        is_upload = request.method == "POST" and request.url.path.endswith("/attachments")
        limit = settings.max_upload_bytes + 200_000 if is_upload else settings.max_body_bytes
        if length and length.isdigit() and int(length) > limit:
            return JSONResponse({"detail": "Requisição grande demais."}, status_code=413)
        # Defesa extra contra CSRF: requisições que alteram dados e vêm de outra origem são recusadas.
        origin = request.headers.get("origin")
        if request.method in UNSAFE_METHODS and origin and origin not in settings.origins:
            return JSONResponse({"detail": "Origem não permitida."}, status_code=403)
        request_id = uuid.uuid4().hex[:12]
        try:
            response = await call_next(request)
        except Exception:
            # Sem detalhes ao cliente; o log guarda a pilha e o ID de correlação (sem corpo da requisição).
            log.exception("erro_interno request_id=%s %s %s", request_id, request.method, request.url.path)
            response = JSONResponse(
                {"detail": "Erro interno. Tente novamente.", "request_id": request_id}, status_code=500
            )
        for k, v in SECURITY_HEADERS.items():
            response.headers.setdefault(k, v)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError):
        return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)

    @app.get("/api/health", tags=["sistema"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_api.router)
    app.include_router(users_api.router)
    app.include_router(subjects_api.router)
    app.include_router(lessons_api.router)
    app.include_router(ai_api.router)
    app.include_router(summaries_api.router)
    app.include_router(dashboard_api.router)
    app.include_router(search_api.router)
    app.include_router(attachments_api.router)
    return app


app = create_app()
