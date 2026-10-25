import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.ai.operations import OPERATIONS
from app.ai.render import render_markdown
from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, get_app_settings, get_limiter
from app.core.rate_limit import RateLimiter
from app.models import AIGeneration, SourceMaterial
from app.repositories import library as repo
from app.schemas.ai import (
    GenerateIn,
    GenerationOut,
    OperationOut,
    OperationsOut,
    SaveGenerationIn,
    SummaryOut,
    UsageOut,
)
from app.schemas.library import Page
from app.services import ai as svc
from app.services import summaries as summaries_svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/ai", tags=["inteligência artificial"])


def _out(db: Session, ctx: AuthContext, gen: AIGeneration, cached: bool) -> GenerationOut:
    op = OPERATIONS[gen.operation]
    material = repo.get_owned(db, SourceMaterial, ctx.user.id, gen.material_id)
    return GenerationOut(
        id=gen.id, material_id=gen.material_id, lesson_id=material.lesson_id, operation=gen.operation,
        operation_label=op.label, detail_level=gen.detail_level, provider=gen.provider, model=gen.model,
        result=gen.result, markdown=render_markdown(op.result_model.model_validate(gen.result)),
        input_tokens=gen.input_tokens, output_tokens=gen.output_tokens,
        estimated_cost_usd=float(gen.estimated_cost_usd), created_at=gen.created_at, cached=cached,
    )


@router.get("/operations", response_model=OperationsOut)
def operations(ctx: AuthContext = Depends(current_auth), settings: Settings = Depends(get_app_settings)):
    return OperationsOut(
        operations=[
            OperationOut(id=o.id, label=o.label, description=o.description, supports_detail=o.supports_detail)
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
        material_id=body.material_id, operation=body.operation, detail_level=body.detail_level,
        force=body.force,
    )
    return _out(db, ctx, gen, cached)


@router.get("/generations", response_model=Page[GenerationOut])
def list_generations(
    material_id: uuid.UUID | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    rows, total = svc.list_generations(db, ctx.user.id, material_id, page, page_size)
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
