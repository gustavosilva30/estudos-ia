"""Acesso ao banco da biblioteca.

REGRA: toda função recebe `user_id` (vindo da sessão autenticada) e filtra por ele.
Nenhuma consulta pode buscar registro privado apenas pelo id.
"""

import uuid
from dataclasses import dataclass
from datetime import date
from typing import TypeVar

from sqlalchemy import Select, exists, func, or_, select
from sqlalchemy.orm import Session

from app.models import Folder, Lesson, Note, SourceMaterial, Subject

M = TypeVar("M")

SORT_COLUMNS = {
    "updated_at": Lesson.updated_at,
    "created_at": Lesson.created_at,
    "title": Lesson.title,
    "lesson_date": Lesson.lesson_date,
}


def get_owned(db: Session, model: type[M], user_id: uuid.UUID, obj_id: uuid.UUID) -> M | None:
    return db.scalar(select(model).where(model.id == obj_id, model.user_id == user_id))


def _like_escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def list_subjects(
    db: Session, user_id: uuid.UUID, *, include_archived: bool, page: int, page_size: int
) -> tuple[list[tuple[Subject, int]], int]:
    where = [Subject.user_id == user_id]
    if not include_archived:
        where.append(Subject.is_archived.is_(False))
    total = db.scalar(select(func.count()).select_from(Subject).where(*where)) or 0
    counts = (
        select(Lesson.subject_id, func.count().label("n"))
        .where(Lesson.user_id == user_id)
        .group_by(Lesson.subject_id)
        .subquery()
    )
    rows = db.execute(
        select(Subject, func.coalesce(counts.c.n, 0))
        .outerjoin(counts, counts.c.subject_id == Subject.id)
        .where(*where)
        .order_by(func.lower(Subject.name))
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [(s, n) for s, n in rows], total


def count_lessons(db: Session, user_id: uuid.UUID, subject_id: uuid.UUID) -> int:
    return db.scalar(
        select(func.count()).select_from(Lesson).where(
            Lesson.user_id == user_id, Lesson.subject_id == subject_id
        )
    ) or 0


def list_folders(db: Session, user_id: uuid.UUID, subject_id: uuid.UUID | None) -> list[Folder]:
    stmt = select(Folder).where(Folder.user_id == user_id).order_by(func.lower(Folder.name))
    if subject_id:
        stmt = stmt.where(Folder.subject_id == subject_id)
    return list(db.scalars(stmt))


@dataclass
class LessonFilters:
    subject_id: uuid.UUID | None = None
    folder_id: uuid.UUID | None = None
    favorite: bool | None = None
    q: str | None = None
    date_from: date | None = None
    date_to: date | None = None
    sort: str = "updated_at"
    descending: bool = True


def search_lessons(
    db: Session, user_id: uuid.UUID, f: LessonFilters, page: int, page_size: int
) -> tuple[list[tuple[Lesson, Subject]], int]:
    base: Select = (
        select(Lesson, Subject)
        .join(Subject, (Subject.id == Lesson.subject_id) & (Subject.user_id == Lesson.user_id))
        .where(Lesson.user_id == user_id)
    )
    if f.subject_id:
        base = base.where(Lesson.subject_id == f.subject_id)
    if f.folder_id:
        base = base.where(Lesson.folder_id == f.folder_id)
    if f.favorite is not None:
        base = base.where(Lesson.is_favorite.is_(f.favorite))
    if f.date_from:
        base = base.where(Lesson.lesson_date >= f.date_from)
    if f.date_to:
        base = base.where(Lesson.lesson_date <= f.date_to)
    if f.q and f.q.strip():
        q = f.q.strip()
        tsq = func.websearch_to_tsquery("portuguese", q)
        in_material = exists().where(
            SourceMaterial.lesson_id == Lesson.id,
            SourceMaterial.user_id == user_id,
            SourceMaterial.search_vector.op("@@")(tsq),
        )
        base = base.where(
            or_(
                Lesson.search_vector.op("@@")(tsq),
                Lesson.title.ilike(f"%{_like_escape(q)}%", escape="\\"),
                in_material,
            )
        )
    total = db.scalar(select(func.count()).select_from(base.with_only_columns(Lesson.id).subquery())) or 0
    col = SORT_COLUMNS[f.sort]
    order = col.desc().nulls_last() if f.descending else col.asc().nulls_last()
    rows = db.execute(
        base.order_by(order, Lesson.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return [(lesson, subject) for lesson, subject in rows], total


def lesson_materials(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> list[SourceMaterial]:
    return list(db.scalars(
        select(SourceMaterial)
        .where(SourceMaterial.user_id == user_id, SourceMaterial.lesson_id == lesson_id)
        .order_by(SourceMaterial.created_at)
    ))


def lesson_notes(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> list[Note]:
    return list(db.scalars(
        select(Note)
        .where(Note.user_id == user_id, Note.lesson_id == lesson_id)
        .order_by(Note.created_at)
    ))
