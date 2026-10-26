import uuid

from fastapi import APIRouter, Depends, File, Request, UploadFile
from sqlalchemy.orm import Session

from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, enforce_limit, get_app_settings, get_limiter
from app.core.errors import AppError, NotFound
from app.core.rate_limit import RateLimiter
from app.models import Lesson
from app.repositories import library as repo
from app.schemas.library import MAX_MATERIAL_CHARS, LinkIn, MaterialOut
from app.services import documents
from app.services import library as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1", tags=["documentos e links"])


def _require_lesson(db: Session, ctx: AuthContext, lesson_id: uuid.UUID) -> None:
    # Antes de qualquer trabalho pesado (ler o PDF, abrir o link): aula de outro usuário responde 404.
    if repo.get_owned(db, Lesson, ctx.user.id, lesson_id) is None:
        raise NotFound("Aula não encontrada.")


def _save(db: Session, ctx: AuthContext, lesson_id: uuid.UUID, text: str, origin: str, source: str):
    if len(text) > MAX_MATERIAL_CHARS:
        raise AppError(
            413,
            f"O texto extraído tem {len(text):,} caracteres (máximo {MAX_MATERIAL_CHARS:,}). "
            "Envie um trecho menor ou divida o documento.".replace(",", "."),
        )
    return svc.add_material_text(db, ctx.user.id, lesson_id, text, origin, source[:500])


@router.post("/lessons/{lesson_id}/materials/from-file", response_model=MaterialOut, status_code=201)
def import_pdf(
    lesson_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    """Lê um PDF e salva o texto extraído como texto original da aula (editável). O arquivo não é guardado."""
    _require_lesson(db, ctx, lesson_id)
    enforce_limit(limiter, settings, f"import:user:{ctx.user.id}", settings.rate_limit_import_user)
    raw = file.file.read(settings.max_document_bytes + 1)
    if len(raw) > settings.max_document_bytes:
        raise AppError(413, f"O arquivo passa de {settings.max_document_bytes // 1_000_000} MB. Envie por partes.")
    text, _pages = documents.extract_pdf_text(raw, settings.max_pdf_pages)
    name = (file.filename or "documento.pdf").replace("\\", "/").rsplit("/", 1)[-1]
    return _save(db, ctx, lesson_id, text, "pdf", name)


@router.post("/lessons/{lesson_id}/materials/from-link", response_model=MaterialOut, status_code=201)
def import_link(
    lesson_id: uuid.UUID,
    body: LinkIn,
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    """Baixa uma página pública (ou PDF) e salva o texto extraído como texto original da aula."""
    _require_lesson(db, ctx, lesson_id)
    enforce_limit(limiter, settings, f"import:user:{ctx.user.id}", settings.rate_limit_import_user)
    text, source = documents.text_from_link(body.url, settings)
    return _save(db, ctx, lesson_id, text, "link", source)
