import uuid
from datetime import date
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import current_auth
from app.repositories import library as repo
from app.schemas.library import (
    AttachmentOut,
    LessonDetail,
    LessonIn,
    LessonListItem,
    LessonOut,
    LessonUpdate,
    MaterialIn,
    MaterialOut,
    MaterialUpdate,
    NoteIn,
    NoteOut,
    Page,
)
from app.services import library as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1", tags=["aulas, textos e anotações"])


def _list_item(lesson, subject) -> LessonListItem:
    return LessonListItem(
        id=lesson.id, title=lesson.title, subject_id=lesson.subject_id, subject_name=subject.name,
        subject_color=subject.color, folder_id=lesson.folder_id, lesson_date=lesson.lesson_date,
        is_favorite=lesson.is_favorite, created_at=lesson.created_at, updated_at=lesson.updated_at,
    )


def _detail(parts: dict) -> LessonDetail:
    return LessonDetail(
        **LessonOut.model_validate(parts["lesson"]).model_dump(),
        materials=[MaterialOut.model_validate(m) for m in parts["materials"]],
        notes=[NoteOut.model_validate(n) for n in parts["notes"]],
        attachments=[AttachmentOut.model_validate(a) for a in parts["attachments"]],
    )


@router.get("/lessons", response_model=Page[LessonListItem])
def list_lessons(
    q: str | None = Query(None, max_length=200, description="Busca em títulos e textos originais"),
    subject_id: uuid.UUID | None = None,
    folder_id: uuid.UUID | None = None,
    favorite: bool | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    sort: Literal["updated_at", "created_at", "title", "lesson_date"] = "updated_at",
    order: Literal["asc", "desc"] = "desc",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    filters = repo.LessonFilters(
        subject_id=subject_id, folder_id=folder_id, favorite=favorite, q=q,
        date_from=date_from, date_to=date_to, sort=sort, descending=order == "desc",
    )
    rows, total = repo.search_lessons(db, ctx.user.id, filters, page, page_size)
    return Page(items=[_list_item(*r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("/lessons", response_model=LessonDetail, status_code=201)
def create_lesson(body: LessonIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    lesson = svc.create_lesson(db, ctx.user.id, body)
    return _detail(svc.lesson_detail(db, ctx.user.id, lesson.id))


@router.get("/lessons/{lesson_id}", response_model=LessonDetail)
def get_lesson(lesson_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return _detail(svc.lesson_detail(db, ctx.user.id, lesson_id))


@router.patch("/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(
    lesson_id: uuid.UUID, body: LessonUpdate,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update_lesson(db, ctx.user.id, lesson_id, body)


@router.delete("/lessons/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_lesson(db, ctx.user.id, lesson_id)


@router.post("/lessons/{lesson_id}/materials", response_model=MaterialOut, status_code=201)
def add_material(
    lesson_id: uuid.UUID, body: MaterialIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.add_material(db, ctx.user.id, lesson_id, body)


@router.patch("/materials/{material_id}", response_model=MaterialOut)
def update_material(
    material_id: uuid.UUID, body: MaterialUpdate,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update_material(db, ctx.user.id, material_id, body.content)


@router.delete("/materials/{material_id}", status_code=204)
def delete_material(material_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_material(db, ctx.user.id, material_id)


@router.post("/lessons/{lesson_id}/notes", response_model=NoteOut, status_code=201)
def add_note(
    lesson_id: uuid.UUID, body: NoteIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.add_note(db, ctx.user.id, lesson_id, body)


@router.patch("/notes/{note_id}", response_model=NoteOut)
def update_note(
    note_id: uuid.UUID, body: NoteIn,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update_note(db, ctx.user.id, note_id, body)


@router.delete("/notes/{note_id}", status_code=204)
def delete_note(note_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_note(db, ctx.user.id, note_id)
