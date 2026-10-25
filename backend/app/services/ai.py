"""Geração com IA: valida propriedade, evita chamadas duplicadas, aplica cotas, trata falhas do
provedor, valida a resposta estruturada e registra consumo. Independe do fornecedor de IA."""

import hashlib
import json
import logging
import time
import uuid
from datetime import UTC, datetime

from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, undefer

from app.ai.cost import estimate_cost_usd, estimate_tokens
from app.ai.operations import (
    OPERATIONS,
    Operation,
    build_image_user_message,
    build_system_prompt,
    build_user_message,
)
from app.ai.profiles import DEFAULT_CATEGORY, get_profile
from app.ai.provider import ImagePart, LLMProvider, LLMRequest, ProviderError
from app.config import Settings
from app.core.errors import AppError, NotFound, TooManyRequests
from app.core.rate_limit import RateLimiter
from app.models import (
    AIGeneration,
    AIUsageLog,
    Attachment,
    Lesson,
    SourceMaterial,
    Subject,
    UserPreference,
)
from app.repositories import library as repo

log = logging.getLogger("estudos.ai")

IMAGE_TOKEN_ESTIMATE = 1500  # só para estimar quando o provedor não informa os tokens de entrada

_ERROR_MESSAGES = {
    "timeout": (504, "A IA demorou demais para responder. Tente novamente."),
    "rate_limited": (503, "O serviço de IA está sobrecarregado no momento. Tente novamente em instantes."),
    "error": (502, "Não foi possível obter resposta da IA. Tente novamente."),
}


def get_operation(operation: str) -> Operation:
    op = OPERATIONS.get(operation)
    if op is None:
        raise AppError(422, f"Operação de IA desconhecida: {operation}.")
    return op


def get_generation(db: Session, user_id: uuid.UUID, generation_id: uuid.UUID) -> AIGeneration:
    gen = repo.get_owned(db, AIGeneration, user_id, generation_id)
    if gen is None:
        raise NotFound("Geração não encontrada.")
    return gen


def list_generations(
    db: Session, user_id: uuid.UUID, material_id: uuid.UUID | None, page: int, page_size: int,
    attachment_id: uuid.UUID | None = None,
) -> tuple[list[AIGeneration], int]:
    where = [AIGeneration.user_id == user_id]
    if material_id:
        where.append(AIGeneration.material_id == material_id)
    if attachment_id:
        where.append(AIGeneration.attachment_id == attachment_id)
    total = db.scalar(select(func.count()).select_from(AIGeneration).where(*where)) or 0
    rows = db.scalars(
        select(AIGeneration).where(*where).order_by(AIGeneration.created_at.desc(), AIGeneration.id)
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(rows), total


def _day_start() -> datetime:
    now = datetime.now(UTC)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _month_start() -> datetime:
    return _day_start().replace(day=1)


def usage_summary(db: Session, settings: Settings, user_id: uuid.UUID) -> dict:
    prefs = db.get(UserPreference, user_id)
    used_today = db.scalar(
        select(func.count()).select_from(AIUsageLog).where(
            AIUsageLog.user_id == user_id, AIUsageLog.created_at >= _day_start()
        )
    ) or 0
    month_cost = db.scalar(
        select(func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0)).where(
            AIUsageLog.user_id == user_id, AIUsageLog.created_at >= _month_start()
        )
    )
    return {
        "used_today": used_today,
        "daily_limit": prefs.daily_ai_limit if prefs else 20,
        "month_cost_usd": float(month_cost or 0),
        "monthly_budget_usd": settings.ai_monthly_budget_usd,
    }


def _enforce_quotas(db: Session, settings: Settings, limiter: RateLimiter, user_id: uuid.UUID) -> None:
    if not limiter.allow(f"ai:{user_id}", settings.ai_rate_limit_per_minute, 60):
        raise TooManyRequests(60)
    usage = usage_summary(db, settings, user_id)
    if usage["used_today"] >= usage["daily_limit"]:
        raise AppError(429, "Você atingiu o limite diário de usos da IA. Tente amanhã ou ajuste o limite nas preferências.")
    if settings.ai_monthly_budget_usd > 0:
        total = db.scalar(
            select(func.coalesce(func.sum(AIUsageLog.estimated_cost_usd), 0)).where(
                AIUsageLog.created_at >= _month_start()
            )
        )
        if float(total or 0) >= settings.ai_monthly_budget_usd:
            raise AppError(429, "O orçamento mensal de IA da plataforma foi atingido.")


def _log_usage(
    db: Session, settings: Settings, provider: LLMProvider, model: str, user_id: uuid.UUID, op: Operation,
    status: str, tokens_in: int, tokens_out: int, started: float, strong: bool,
) -> None:
    db.add(AIUsageLog(
        user_id=user_id, operation=op.id, provider=provider.name, model=model, status=status,
        input_tokens=tokens_in, output_tokens=tokens_out,
        estimated_cost_usd=estimate_cost_usd(settings, tokens_in, tokens_out, strong=strong),
        duration_ms=int((time.monotonic() - started) * 1000),
    ))
    db.commit()
    # Só metadados: nunca o conteúdo do usuário, as imagens nem a resposta.
    log.info("ia_chamada op=%s status=%s tokens_in=%s tokens_out=%s", op.id, status, tokens_in, tokens_out)


def _call_with_retries(
    db: Session, settings: Settings, provider: LLMProvider, user_id: uuid.UUID, op: Operation, request: LLMRequest,
    *, model: str, strong: bool,
):
    """Chama o provedor; repete só falhas transitórias/resposta inválida; valida o JSON recebido."""
    attempts = 1 + max(0, settings.ai_max_retries)
    est_in = estimate_tokens(request.system + request.user) + IMAGE_TOKEN_ESTIMATE * len(request.images)
    last_status = "error"
    for attempt in range(attempts):
        started = time.monotonic()
        try:
            response = provider.complete(request)
        except ProviderError as exc:
            last_status = exc.status
            _log_usage(db, settings, provider, model, user_id, op, exc.status, est_in, 0, started, strong)
            if exc.retryable and attempt < attempts - 1:
                time.sleep(settings.ai_retry_backoff_seconds * (2**attempt))
                continue
            break
        tokens_in = response.input_tokens if response.input_tokens is not None else est_in
        tokens_out = response.output_tokens if response.output_tokens is not None else estimate_tokens(response.text)
        try:
            result = op.result_model.model_validate(json.loads(response.text))
        except (ValueError, ValidationError):
            last_status = "invalid_output"
            _log_usage(db, settings, provider, response.model, user_id, op, "invalid_output", tokens_in, tokens_out, started, strong)
            if attempt < attempts - 1:
                continue
            break
        _log_usage(db, settings, provider, response.model, user_id, op, "ok", tokens_in, tokens_out, started, strong)
        return result, response.model, tokens_in, tokens_out
    if last_status == "invalid_output":
        raise AppError(502, "A IA devolveu uma resposta fora do formato esperado. Tente novamente.")
    code, message = _ERROR_MESSAGES.get(last_status, _ERROR_MESSAGES["error"])
    raise AppError(code, message)


def _category_of_lesson(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> str:
    return db.scalar(
        select(Subject.category)
        .join(Lesson, (Lesson.subject_id == Subject.id) & (Lesson.user_id == Subject.user_id))
        .where(Lesson.id == lesson_id, Lesson.user_id == user_id)
    ) or DEFAULT_CATEGORY


def generate(
    db: Session, settings: Settings, provider: LLMProvider, limiter: RateLimiter, *,
    user_id: uuid.UUID, operation: str, detail_level: str | None, force: bool,
    material_id: uuid.UUID | None = None, attachment_id: uuid.UUID | None = None,
) -> tuple[AIGeneration, bool]:
    """Devolve (geração, veio_do_cache). Chamadas repetidas com a mesma origem não custam nada.
    A origem é um texto salvo (material_id) OU uma imagem (attachment_id)."""
    op = get_operation(operation)
    if (material_id is None) == (attachment_id is None):
        raise AppError(422, "Informe o texto ou a imagem a usar (apenas um dos dois).")
    source = "material" if material_id is not None else "attachment"
    if source not in op.inputs:
        raise AppError(
            422,
            "Esta operação trabalha com uma imagem enviada." if source == "material"
            else "Esta operação trabalha com texto. Use primeiro 'Imagem para texto' ou 'Resolver problema'.",
        )

    images: tuple[ImagePart, ...] = ()
    if material_id is not None:
        material = repo.get_owned(db, SourceMaterial, user_id, material_id)
        if material is None:
            raise NotFound("Texto não encontrado.")
        if len(material.content) > settings.ai_max_input_chars:
            raise AppError(
                413, f"O texto tem mais de {settings.ai_max_input_chars} caracteres, limite para uso com IA. Divida o conteúdo em partes."
            )
        lesson_id, content_key = material.lesson_id, material.content_hash
        user_message = build_user_message(material.content)
    else:
        attachment = db.scalar(
            select(Attachment).options(undefer(Attachment.data))
            .where(Attachment.id == attachment_id, Attachment.user_id == user_id)
        )
        if attachment is None:
            raise NotFound("Imagem não encontrada.")
        lesson_id, content_key = attachment.lesson_id, attachment.sha256
        user_message = build_image_user_message(op)
        images = (ImagePart(mime_type=attachment.mime_type, data=attachment.data),)

    # A categoria da matéria muda o prompt (exceto na transcrição, que deve ser fiel em qualquer área).
    profile = get_profile(_category_of_lesson(db, user_id, lesson_id)) if op.kind != "ocr" else None
    strong = op.tier == "strong" and bool(settings.ai_model_strong)
    model = settings.ai_model_strong if strong else settings.ai_model

    prefs = db.get(UserPreference, user_id)
    detail = op.normalize_detail(detail_level or (prefs.default_detail_level if prefs else None))
    raw_key = f"{content_key}|{op.id}|{detail}|{op.prompt_version}|{provider.name}|{model}|{profile.id if profile else '-'}"
    key = hashlib.sha256(raw_key.encode()).hexdigest()

    def find_existing() -> AIGeneration | None:
        origin = AIGeneration.material_id == material_id if material_id is not None else AIGeneration.attachment_id == attachment_id
        return db.scalar(select(AIGeneration).where(
            AIGeneration.user_id == user_id, origin, AIGeneration.operation == op.id,
            AIGeneration.detail_level == detail, AIGeneration.input_hash == key,
        ))

    existing = find_existing()
    if existing is not None and not force:
        return existing, True

    _enforce_quotas(db, settings, limiter, user_id)
    request = LLMRequest(
        operation=op.id,
        system=build_system_prompt(op, detail, profile, has_image=bool(images)),
        user=user_message,
        json_schema=op.result_model.model_json_schema(),
        max_output_tokens=min(settings.ai_max_output_tokens, op.max_output_tokens or settings.ai_max_output_tokens),
        timeout_seconds=settings.ai_timeout_seconds,
        model=model,
        images=images,
    )
    result, used_model, tokens_in, tokens_out = _call_with_retries(
        db, settings, provider, user_id, op, request, model=model, strong=strong
    )

    fields = {
        "provider": provider.name, "model": used_model, "result": result.model_dump(),
        "input_tokens": tokens_in, "output_tokens": tokens_out,
        "estimated_cost_usd": estimate_cost_usd(settings, tokens_in, tokens_out, strong=strong),
    }
    if existing is not None:  # regeneração explícita (force): substitui a geração, não o original
        for k, v in fields.items():
            setattr(existing, k, v)
        db.commit()
        return existing, False
    generation = AIGeneration(
        user_id=user_id, material_id=material_id, attachment_id=attachment_id, operation=op.id,
        detail_level=detail, input_hash=key, **fields,
    )
    db.add(generation)
    try:
        db.commit()
    except IntegrityError:  # duas requisições simultâneas: fica com a que gravou primeiro
        db.rollback()
        winner = find_existing()
        if winner is None:
            raise
        return winner, True
    return generation, False
