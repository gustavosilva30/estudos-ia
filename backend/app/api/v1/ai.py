import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.ai.operations import OPERATIONS, OcrResult
from app.ai.render import render_markdown
from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, get_app_settings, get_limiter
from app.core.errors import AppError
from app.core.rate_limit import RateLimiter
from app.models import AIGeneration, Attachment, SourceMaterial
from app.repositories import library as repo
from app.schemas.ai import (
    GenerateIn,
    GenerationOut,
    OperationOut,
    OperationsOut,
    SaveAsMaterialIn,
    SaveGenerationIn,
    SummaryOut,
    UsageOut,
)
from app.schemas.library import MaterialOut, Page
from app.services import ai as svc
from app.services import library as library_svc
from app.services import summaries as summaries_svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/ai", tags=["inteligência artificial"])


def _lesson_id_of(db: Session, ctx: AuthContext, gen: AIGeneration):
    if gen.material_id is not None:
        return repo.get_owned(db, SourceMaterial, ctx.user.id, gen.material_id).lesson_id
    return repo.get_owned(db, Attachment, ctx.user.id, gen.attachment_id).lesson_id


def _out(db: Session, ctx: AuthContext, gen: AIGeneration, cached: bool) -> GenerationOut:
    op = OPERATIONS[gen.operation]
    return GenerationOut(
        id=gen.id, material_id=gen.material_id, attachment_id=gen.attachment_id,
        lesson_id=_lesson_id_of(db, ctx, gen), operation=gen.operation,
        operation_label=op.label, detail_level=gen.detail_level, provider=gen.provider, model=gen.model,
        result=gen.result, markdown=render_markdown(op.result_model.model_validate(gen.result)),
        input_tokens=gen.input_tokens, output_tokens=gen.output_tokens,
        estimated_cost_usd=float(gen.estimated_cost_usd), created_at=gen.created_at, cached=cached,
    )


@router.get("/operations", response_model=OperationsOut)
def operations(ctx: AuthContext = Depends(current_auth), settings: Settings = Depends(get_app_settings)):
    return OperationsOut(
        operations=[
            OperationOut(
                id=o.id, label=o.label, description=o.description, supports_detail=o.supports_detail,
                inputs=list(o.inputs),
            )
            for o in OPERATIONS.values()
        ],
        max_input_chars=settings.ai_max_input_chars,
    )


@router.get("/usage", response_model=UsageOut)
def usage(
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    return svc.usage_summary(db, settings, ctx.user.id)


@router.post("/generate", response_model=GenerationOut)
def generate(
    body: GenerateIn,
    request: Request,
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
    limiter: RateLimiter = Depends(get_limiter),
):
    gen, cached = svc.generate(
        db, settings, request.app.state.provider, limiter, user_id=ctx.user.id,
        material_id=body.material_id, attachment_id=body.attachment_id, operation=body.operation,
        detail_level=body.detail_level, force=body.force,
    )
    return _out(db, ctx, gen, cached)


@router.get("/generations", response_model=Page[GenerationOut])
def list_generations(
    material_id: uuid.UUID | None = None,
    attachment_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    rows, total = svc.list_generations(db, ctx.user.id, material_id, page, page_size, attachment_id)
    return Page(items=[_out(db, ctx, g, True) for g in rows], total=total, page=page, page_size=page_size)


@router.get("/generations/{generation_id}", response_model=GenerationOut)
def get_generation(generation_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return _out(db, ctx, svc.get_generation(db, ctx.user.id, generation_id), True)


@router.post("/generations/{generation_id}/save", response_model=SummaryOut, status_code=201)
def save_generation(
    generation_id: uuid.UUID, body: SaveGenerationIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    """Salva o resultado como resumo editável. O texto original não é alterado."""
    return summaries_svc.save_generation(db, ctx.user.id, generation_id, body.title)


@router.post("/generations/{generation_id}/save-as-material", response_model=MaterialOut, status_code=201)
def save_as_material(
    generation_id: uuid.UUID, body: SaveAsMaterialIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    """Transforma a transcrição de uma imagem em texto original da aula. `content` permite salvar a versão
    que a pessoa revisou/corrigiu; sem ele, usa o texto transcrito pela IA."""
    gen = svc.get_generation(db, ctx.user.id, generation_id)
    if gen.operation != "ocr_imagem":
        raise AppError(400, "Só a transcrição de imagem pode ser salva como texto original.")
    text = body.content if body.content is not None else OcrResult.model_validate(gen.result).text
    return library_svc.add_material_text(db, ctx.user.id, _lesson_id_of(db, ctx, gen), text, "image")
