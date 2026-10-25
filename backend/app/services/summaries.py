"""Resumos editáveis com histórico de versões. O texto original (source_materials) nunca é tocado aqui."""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.ai.operations import OPERATIONS
from app.ai.render import render_markdown
from app.core.errors import AppError, NotFound
from app.models import AIGeneration, Attachment, Lesson, SourceMaterial, Summary, SummaryVersion
from app.repositories import library as repo
from app.schemas.ai import SummaryCreate, SummaryUpdate


def _owned_summary(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID) -> Summary:
    summary = repo.get_owned(db, Summary, user_id, summary_id)
    if summary is None:
        raise NotFound("Resumo não encontrado.")
    return summary


def _touch_lesson(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> None:
    """Estudar/editar material da aula a coloca entre os conteúdos recentes."""
    lesson = repo.get_owned(db, Lesson, user_id, lesson_id)
    if lesson is not None:
        lesson.updated_at = func.clock_timestamp()


def _add_version(db: Session, summary: Summary, origin: str) -> None:
    db.add(SummaryVersion(
        user_id=summary.user_id, summary_id=summary.id, version_number=summary.current_version,
        title=summary.title, content=summary.content, origin=origin,
    ))


def _new(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, kind: str, title: str, content: str,
         generation_id: uuid.UUID | None, origin: str) -> Summary:
    summary = Summary(
        user_id=user_id, lesson_id=lesson_id, generation_id=generation_id, kind=kind,
        title=title[:200], content=content, current_version=1,
    )
    db.add(summary)
    db.flush()
    _add_version(db, summary, origin)
    _touch_lesson(db, user_id, lesson_id)
    db.commit()
    return summary


def create_manual(db: Session, user_id: uuid.UUID, body: SummaryCreate) -> Summary:
    if repo.get_owned(db, Lesson, user_id, body.lesson_id) is None:
        raise NotFound("Aula não encontrada.")
    return _new(db, user_id, body.lesson_id, "manual", body.title, body.content, None, "user")


def save_generation(db: Session, user_id: uuid.UUID, generation_id: uuid.UUID, title: str | None) -> Summary:
    gen = repo.get_owned(db, AIGeneration, user_id, generation_id)
    if gen is None:
        raise NotFound("Geração não encontrada.")
    if gen.material_id is not None:
        lesson_id = repo.get_owned(db, SourceMaterial, user_id, gen.material_id).lesson_id
    else:
        lesson_id = repo.get_owned(db, Attachment, user_id, gen.attachment_id).lesson_id
    op = OPERATIONS[gen.operation]
    result = op.result_model.model_validate(gen.result)
    return _new(
        db, user_id, lesson_id, gen.operation, title or result.title,
        render_markdown(result), gen.id, "ai",
    )


def get(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID) -> Summary:
    return _owned_summary(db, user_id, summary_id)


def list_summaries(
    db: Session, user_id: uuid.UUID, *, lesson_id: uuid.UUID | None, favorite: bool | None,
    kind: str | None, q: str | None, page: int, page_size: int,
) -> tuple[list[Summary], int]:
    where = [Summary.user_id == user_id]
    if lesson_id:
        where.append(Summary.lesson_id == lesson_id)
    if favorite is not None:
        where.append(Summary.is_favorite.is_(favorite))
    if kind:
        where.append(Summary.kind == kind)
    if q and q.strip():
        tsq = func.websearch_to_tsquery("portuguese", q.strip())
        like = f"%{repo._like_escape(q.strip())}%"
        where.append(or_(Summary.search_vector.op("@@")(tsq), Summary.title.ilike(like, escape="\\")))
    total = db.scalar(select(func.count()).select_from(Summary).where(*where)) or 0
    rows = db.scalars(
        select(Summary).where(*where).order_by(Summary.updated_at.desc(), Summary.id)
        .offset((page - 1) * page_size).limit(page_size)
    )
    return list(rows), total


def update(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID, body: SummaryUpdate) -> Summary:
    summary = _owned_summary(db, user_id, summary_id)
    changed = False
    if body.title is not None and body.title != summary.title:
        summary.title, changed = body.title, True
    if body.content is not None and body.content != summary.content:
        summary.content, changed = body.content, True
    if body.is_favorite is not None:
        summary.is_favorite = body.is_favorite
    if changed:  # cada alteração de título/conteúdo gera uma nova versão; as anteriores ficam preservadas
        summary.current_version += 1
        _add_version(db, summary, "user")
        _touch_lesson(db, user_id, summary.lesson_id)
    db.commit()
    return summary


def versions(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID) -> list[SummaryVersion]:
    _owned_summary(db, user_id, summary_id)
    return list(db.scalars(
        select(SummaryVersion)
        .where(SummaryVersion.user_id == user_id, SummaryVersion.summary_id == summary_id)
        .order_by(SummaryVersion.version_number.desc())
    ))


def restore_version(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID, number: int) -> Summary:
    summary = _owned_summary(db, user_id, summary_id)
    old = db.scalar(select(SummaryVersion).where(
        SummaryVersion.user_id == user_id, SummaryVersion.summary_id == summary.id,
        SummaryVersion.version_number == number,
    ))
    if old is None:
        raise NotFound("Versão não encontrada.")
    if old.title == summary.title and old.content == summary.content:
        raise AppError(400, "Esta já é a versão atual.")
    summary.title, summary.content = old.title, old.content
    summary.current_version += 1  # restaurar cria uma nova versão; nada é apagado
    _add_version(db, summary, "user")
    db.commit()
    return summary


def duplicate(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID) -> Summary:
    src = _owned_summary(db, user_id, summary_id)
    return _new(
        db, user_id, src.lesson_id, src.kind, f"{src.title[:190]} (cópia)", src.content,
        src.generation_id, "duplicate",
    )


def delete(db: Session, user_id: uuid.UUID, summary_id: uuid.UUID) -> None:
    db.delete(_owned_summary(db, user_id, summary_id))
    db.commit()
