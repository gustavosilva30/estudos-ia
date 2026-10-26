"""Fórmulas do usuário: favoritos/anotações, fórmulas próprias e vínculo com aulas.
Toda consulta filtra pelo usuário da sessão; recurso de outra pessoa responde 404."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError, NotFound
from app.models import Lesson, Subject
from app.models.formulas import CustomFormula, FormulaMark, LessonFormula
from app.repositories import library as repo
from app.schemas.formulas import CustomFormulaIn, MarkIn, MarkOut, validate_key

MAX_CUSTOM_FORMULAS = 100
MAX_MARKS = 1_000
MAX_LINKS_PER_LESSON = 50


def _check_key(db: Session, user_id: uuid.UUID, key: str) -> None:
    """Chaves do catálogo (`b:`) valem sempre; as próprias (`c:`) precisam existir e ser do usuário."""
    try:
        validate_key(key)
    except ValueError:
        raise AppError(422, "Fórmula inválida.") from None
    if key.startswith("c:") and repo.get_owned(db, CustomFormula, user_id, uuid.UUID(key[2:])) is None:
        raise NotFound("Fórmula não encontrada.")


# ---------- favoritos e anotações ----------

def list_marks(db: Session, user_id: uuid.UUID) -> list[FormulaMark]:
    return list(db.scalars(select(FormulaMark).where(FormulaMark.user_id == user_id).order_by(FormulaMark.updated_at.desc())))


def set_mark(db: Session, user_id: uuid.UUID, key: str, body: MarkIn) -> MarkOut:
    _check_key(db, user_id, key)
    mark = db.scalar(select(FormulaMark).where(FormulaMark.user_id == user_id, FormulaMark.formula_key == key))
    if mark is None:
        total = db.scalar(select(func.count()).select_from(FormulaMark).where(FormulaMark.user_id == user_id)) or 0
        if total >= MAX_MARKS:
            raise AppError(409, "Limite de fórmulas marcadas atingido.")
        mark = FormulaMark(user_id=user_id, formula_key=key, is_favorite=False, note=None)
        db.add(mark)
    if body.is_favorite is not None:
        mark.is_favorite = body.is_favorite
    if body.note is not None:
        mark.note = body.note.strip() or None
    if not mark.is_favorite and mark.note is None:  # nada a guardar: remove a linha
        if mark in db:
            db.delete(mark)
        db.commit()
        return MarkOut(formula_key=key, is_favorite=False, note=None, updated_at=datetime.now(UTC))
    try:
        db.commit()
    except IntegrityError:  # duas requisições simultâneas criando a mesma marca
        db.rollback()
        return set_mark(db, user_id, key, body)
    db.refresh(mark)
    return MarkOut.model_validate(mark)


# ---------- fórmulas próprias ----------

def list_custom(db: Session, user_id: uuid.UUID) -> list[CustomFormula]:
    return list(db.scalars(
        select(CustomFormula).where(CustomFormula.user_id == user_id).order_by(CustomFormula.created_at.desc())
    ))


def _apply(formula: CustomFormula, body: CustomFormulaIn) -> None:
    formula.title = body.title
    formula.category = body.category
    formula.latex = (body.latex or "").strip() or None
    formula.description = (body.description or "").strip() or None
    formula.variables = [v.model_dump() for v in body.variables]
    formula.expression = body.expression
    formula.result_name = body.result_name
    formula.result_label = body.result_label
    formula.result_unit = (body.result_unit or "").strip() or None


def create_custom(db: Session, user_id: uuid.UUID, body: CustomFormulaIn) -> CustomFormula:
    total = db.scalar(select(func.count()).select_from(CustomFormula).where(CustomFormula.user_id == user_id)) or 0
    if total >= MAX_CUSTOM_FORMULAS:
        raise AppError(409, f"Você já tem {MAX_CUSTOM_FORMULAS} fórmulas próprias (o máximo). Exclua alguma para criar outra.")
    formula = CustomFormula(user_id=user_id)
    _apply(formula, body)
    db.add(formula)
    db.commit()
    return formula


def update_custom(db: Session, user_id: uuid.UUID, formula_id: uuid.UUID, body: CustomFormulaIn) -> CustomFormula:
    formula = repo.get_owned(db, CustomFormula, user_id, formula_id)
    if formula is None:
        raise NotFound("Fórmula não encontrada.")
    _apply(formula, body)
    db.commit()
    return formula


def delete_custom(db: Session, user_id: uuid.UUID, formula_id: uuid.UUID) -> None:
    formula = repo.get_owned(db, CustomFormula, user_id, formula_id)
    if formula is None:
        raise NotFound("Fórmula não encontrada.")
    key = f"c:{formula.id}"
    db.execute(delete(FormulaMark).where(FormulaMark.user_id == user_id, FormulaMark.formula_key == key))
    db.execute(delete(LessonFormula).where(LessonFormula.user_id == user_id, LessonFormula.formula_key == key))
    db.delete(formula)
    db.commit()


# ---------- vínculo com aulas ----------

def _lesson(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> Lesson:
    lesson = repo.get_owned(db, Lesson, user_id, lesson_id)
    if lesson is None:
        raise NotFound("Aula não encontrada.")
    return lesson


def list_lesson_links(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> list[LessonFormula]:
    _lesson(db, user_id, lesson_id)
    return list(db.scalars(
        select(LessonFormula)
        .where(LessonFormula.user_id == user_id, LessonFormula.lesson_id == lesson_id)
        .order_by(LessonFormula.created_at)
    ))


def add_lesson_link(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, key: str) -> LessonFormula:
    _lesson(db, user_id, lesson_id)
    _check_key(db, user_id, key)
    existing = db.scalar(select(LessonFormula).where(
        LessonFormula.user_id == user_id, LessonFormula.lesson_id == lesson_id, LessonFormula.formula_key == key
    ))
    if existing is not None:
        return existing
    count = db.scalar(select(func.count()).select_from(LessonFormula).where(
        LessonFormula.user_id == user_id, LessonFormula.lesson_id == lesson_id
    )) or 0
    if count >= MAX_LINKS_PER_LESSON:
        raise AppError(409, f"Esta aula já tem {MAX_LINKS_PER_LESSON} fórmulas vinculadas (o máximo).")
    link = LessonFormula(user_id=user_id, lesson_id=lesson_id, formula_key=key)
    db.add(link)
    db.commit()
    return link


def remove_lesson_link(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, key: str) -> None:
    _lesson(db, user_id, lesson_id)
    link = db.scalar(select(LessonFormula).where(
        LessonFormula.user_id == user_id, LessonFormula.lesson_id == lesson_id, LessonFormula.formula_key == key
    ))
    if link is None:
        raise NotFound("A fórmula não está vinculada a esta aula.")
    db.delete(link)
    db.commit()


def lessons_of_formula(db: Session, user_id: uuid.UUID, key: str) -> list[tuple[uuid.UUID, str, str]]:
    _check_key(db, user_id, key)
    rows = db.execute(
        select(Lesson.id, Lesson.title, Subject.name)
        .join(LessonFormula, (LessonFormula.lesson_id == Lesson.id) & (LessonFormula.user_id == Lesson.user_id))
        .join(Subject, (Subject.id == Lesson.subject_id) & (Subject.user_id == Lesson.user_id))
        .where(LessonFormula.user_id == user_id, LessonFormula.formula_key == key)
        .order_by(Lesson.title)
    )
    return [(r[0], r[1], r[2]) for r in rows]
