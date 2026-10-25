"""Regras de negócio da biblioteca. Toda operação recebe `user_id` da sessão e verifica a propriedade
de CADA recurso referenciado (inclusive ids vindos no corpo, como subject_id e folder_id).
Recursos de outros usuários respondem 404, sem revelar que existem."""

import hashlib
import uuid
from typing import TypeVar

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AppError, NotFound
from app.models import Folder, Lesson, Note, SourceMaterial, Subject
from app.repositories import library as repo
from app.schemas.library import (
    FolderIn,
    FolderUpdate,
    LessonIn,
    LessonUpdate,
    MaterialIn,
    NoteIn,
    SubjectIn,
    SubjectUpdate,
)

M = TypeVar("M")


def _owned(db: Session, model: type[M], user_id: uuid.UUID, obj_id: uuid.UUID | None, what: str) -> M:
    obj = repo.get_owned(db, model, user_id, obj_id) if obj_id else None
    if obj is None:
        raise NotFound(f"{what} não encontrada.")
    return obj


def content_hash(content: str) -> str:
    return hashlib.sha256(content.encode()).hexdigest()


def _require_text(content: str) -> None:
    if not content.strip():
        raise AppError(422, "O texto não pode estar vazio.")


def _commit(db: Session, conflict_message: str | None = None) -> None:
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(409, conflict_message or "Operação conflita com os dados existentes.") from None


# ---------- matérias ----------

def create_subject(db: Session, user_id: uuid.UUID, body: SubjectIn) -> Subject:
    subject = Subject(user_id=user_id, **body.model_dump())
    db.add(subject)
    _commit(db, "Você já tem uma matéria com este nome.")
    return subject


def get_subject(db: Session, user_id: uuid.UUID, subject_id: uuid.UUID) -> tuple[Subject, int]:
    subject = _owned(db, Subject, user_id, subject_id, "Matéria")
    return subject, repo.count_lessons(db, user_id, subject.id)


def update_subject(
    db: Session, user_id: uuid.UUID, subject_id: uuid.UUID, body: SubjectUpdate
) -> tuple[Subject, int]:
    subject = _owned(db, Subject, user_id, subject_id, "Matéria")
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field in ("name", "is_archived", "category"):
            continue
        setattr(subject, field, value)
    _commit(db, "Você já tem uma matéria com este nome.")
    return subject, repo.count_lessons(db, user_id, subject.id)


def delete_subject(db: Session, user_id: uuid.UUID, subject_id: uuid.UUID) -> None:
    subject = _owned(db, Subject, user_id, subject_id, "Matéria")
    db.delete(subject)  # cascata no banco: pastas, aulas, textos e anotações
    db.commit()


# ---------- pastas ----------

def _check_parent(
    db: Session, user_id: uuid.UUID, subject_id: uuid.UUID, parent_id: uuid.UUID | None,
    self_id: uuid.UUID | None = None,
) -> None:
    if parent_id is None:
        return
    parent = _owned(db, Folder, user_id, parent_id, "Pasta pai")
    if parent.subject_id != subject_id:
        raise AppError(400, "A pasta pai deve pertencer à mesma matéria.")
    # Impede ciclos: sobe pela árvore a partir do novo pai.
    node = parent
    while node is not None and self_id is not None:
        if node.id == self_id:
            raise AppError(400, "Uma pasta não pode ser movida para dentro de si mesma.")
        node = repo.get_owned(db, Folder, user_id, node.parent_id) if node.parent_id else None


def create_folder(db: Session, user_id: uuid.UUID, body: FolderIn) -> Folder:
    _owned(db, Subject, user_id, body.subject_id, "Matéria")
    _check_parent(db, user_id, body.subject_id, body.parent_id)
    folder = Folder(user_id=user_id, **body.model_dump())
    db.add(folder)
    _commit(db)
    return folder


def update_folder(db: Session, user_id: uuid.UUID, folder_id: uuid.UUID, body: FolderUpdate) -> Folder:
    folder = _owned(db, Folder, user_id, folder_id, "Pasta")
    data = body.model_dump(exclude_unset=True)
    if "parent_id" in data:
        _check_parent(db, user_id, folder.subject_id, data["parent_id"], self_id=folder.id)
        folder.parent_id = data["parent_id"]
    if data.get("name"):
        folder.name = data["name"]
    _commit(db)
    return folder


def delete_folder(db: Session, user_id: uuid.UUID, folder_id: uuid.UUID) -> None:
    """Não apaga conteúdo: aulas voltam para a raiz da matéria e subpastas sobem um nível."""
    folder = _owned(db, Folder, user_id, folder_id, "Pasta")
    db.execute(
        update(Lesson).where(Lesson.user_id == user_id, Lesson.folder_id == folder.id).values(folder_id=None)
    )
    db.execute(
        update(Folder)
        .where(Folder.user_id == user_id, Folder.parent_id == folder.id)
        .values(parent_id=folder.parent_id)
    )
    db.delete(folder)
    db.commit()


# ---------- aulas ----------

def _check_folder(db: Session, user_id: uuid.UUID, subject_id: uuid.UUID, folder_id: uuid.UUID | None) -> None:
    if folder_id is None:
        return
    folder = _owned(db, Folder, user_id, folder_id, "Pasta")
    if folder.subject_id != subject_id:
        raise AppError(400, "A pasta deve pertencer à mesma matéria da aula.")


def create_lesson(db: Session, user_id: uuid.UUID, body: LessonIn) -> Lesson:
    _owned(db, Subject, user_id, body.subject_id, "Matéria")
    _check_folder(db, user_id, body.subject_id, body.folder_id)
    lesson = Lesson(
        user_id=user_id, subject_id=body.subject_id, folder_id=body.folder_id, title=body.title,
        lesson_date=body.lesson_date, observations=body.observations,
    )
    db.add(lesson)
    db.flush()
    if body.content and body.content.strip():
        db.add(SourceMaterial(
            user_id=user_id, lesson_id=lesson.id, content=body.content,
            content_hash=content_hash(body.content), origin=body.origin,
        ))
    db.commit()
    return lesson


def update_lesson(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, body: LessonUpdate) -> Lesson:
    lesson = _owned(db, Lesson, user_id, lesson_id, "Aula")
    data = body.model_dump(exclude_unset=True)
    for non_nullable in ("subject_id", "title", "is_favorite"):
        if non_nullable in data and data[non_nullable] is None:
            data.pop(non_nullable)

    subject_id = data.get("subject_id", lesson.subject_id)
    if subject_id != lesson.subject_id:
        _owned(db, Subject, user_id, subject_id, "Matéria")
        if "folder_id" not in data:
            data["folder_id"] = None  # a pasta antiga pertence a outra matéria
    folder_id = data.get("folder_id", lesson.folder_id)
    _check_folder(db, user_id, subject_id, folder_id)

    for field, value in data.items():
        setattr(lesson, field, value)
    db.commit()
    return lesson


def delete_lesson(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> None:
    db.delete(_owned(db, Lesson, user_id, lesson_id, "Aula"))
    db.commit()


def lesson_detail(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID) -> dict:
    lesson = _owned(db, Lesson, user_id, lesson_id, "Aula")
    return {
        "lesson": lesson,
        "materials": repo.lesson_materials(db, user_id, lesson.id),
        "notes": repo.lesson_notes(db, user_id, lesson.id),
        "attachments": repo.lesson_attachments(db, user_id, lesson.id),
    }


def _touch(lesson: Lesson) -> None:
    # Mantém "recentes" coerente quando o conteúdo muda. clock_timestamp() (e não now())
    # garante instante distinto mesmo para várias alterações dentro de uma transação.
    lesson.updated_at = func.clock_timestamp()


# ---------- textos originais ----------

def add_material(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, body: MaterialIn) -> SourceMaterial:
    return add_material_text(db, user_id, lesson_id, body.content, body.origin)


def add_material_text(
    db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, content: str, origin: str
) -> SourceMaterial:
    """origin: typed | pasted | image (texto extraído de uma imagem, já revisado pelo usuário)."""
    lesson = _owned(db, Lesson, user_id, lesson_id, "Aula")
    _require_text(content)
    material = SourceMaterial(
        user_id=user_id, lesson_id=lesson.id, content=content, content_hash=content_hash(content), origin=origin,
    )
    db.add(material)
    _touch(lesson)
    db.commit()
    return material


def update_material(db: Session, user_id: uuid.UUID, material_id: uuid.UUID, content: str) -> SourceMaterial:
    material = _owned(db, SourceMaterial, user_id, material_id, "Texto")
    _require_text(content)
    material.content = content
    material.content_hash = content_hash(content)
    _touch(_owned(db, Lesson, user_id, material.lesson_id, "Aula"))
    db.commit()
    return material


def delete_material(db: Session, user_id: uuid.UUID, material_id: uuid.UUID) -> None:
    material = _owned(db, SourceMaterial, user_id, material_id, "Texto")
    _touch(_owned(db, Lesson, user_id, material.lesson_id, "Aula"))
    db.delete(material)
    db.commit()


# ---------- anotações ----------

def add_note(db: Session, user_id: uuid.UUID, lesson_id: uuid.UUID, body: NoteIn) -> Note:
    lesson = _owned(db, Lesson, user_id, lesson_id, "Aula")
    _require_text(body.content)
    note = Note(user_id=user_id, lesson_id=lesson.id, content=body.content)
    db.add(note)
    _touch(lesson)
    db.commit()
    return note


def update_note(db: Session, user_id: uuid.UUID, note_id: uuid.UUID, body: NoteIn) -> Note:
    note = _owned(db, Note, user_id, note_id, "Anotação")
    _require_text(body.content)
    note.content = body.content
    _touch(_owned(db, Lesson, user_id, note.lesson_id, "Aula"))
    db.commit()
    return note


def delete_note(db: Session, user_id: uuid.UUID, note_id: uuid.UUID) -> None:
    note = _owned(db, Note, user_id, note_id, "Anotação")
    _touch(_owned(db, Lesson, user_id, note.lesson_id, "Aula"))
    db.delete(note)
    db.commit()
