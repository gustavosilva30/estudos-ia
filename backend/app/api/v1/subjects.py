import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.ai.profiles import CATEGORIES
from app.core.db import get_db
from app.core.deps import current_auth
from app.repositories import library as repo
from app.schemas.library import (
    FolderIn,
    FolderOut,
    FolderUpdate,
    Page,
    SubjectIn,
    SubjectOut,
    SubjectUpdate,
)
from app.services import library as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1", tags=["matérias e pastas"])


def _subject_out(subject, lesson_count: int) -> SubjectOut:
    out = SubjectOut.model_validate(subject)
    out.lesson_count = lesson_count
    return out


@router.get("/subject-categories")
def subject_categories(ctx: AuthContext = Depends(current_auth)):
    """Áreas de conhecimento que a pessoa pode escolher para uma matéria (a IA se adapta a cada uma)."""
    return [{"id": c.id, "label": c.label, "description": c.description} for c in CATEGORIES.values()]


@router.get("/subjects", response_model=Page[SubjectOut])
def list_subjects(
    include_archived: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    rows, total = repo.list_subjects(
        db, ctx.user.id, include_archived=include_archived, page=page, page_size=page_size
    )
    return Page(items=[_subject_out(s, n) for s, n in rows], total=total, page=page, page_size=page_size)


@router.post("/subjects", response_model=SubjectOut, status_code=201)
def create_subject(body: SubjectIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return _subject_out(svc.create_subject(db, ctx.user.id, body), 0)


@router.get("/subjects/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return _subject_out(*svc.get_subject(db, ctx.user.id, subject_id))


@router.patch("/subjects/{subject_id}", response_model=SubjectOut)
def update_subject(
    subject_id: uuid.UUID, body: SubjectUpdate,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return _subject_out(*svc.update_subject(db, ctx.user.id, subject_id, body))


@router.delete("/subjects/{subject_id}", status_code=204)
def delete_subject(subject_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_subject(db, ctx.user.id, subject_id)


@router.get("/folders", response_model=list[FolderOut])
def list_folders(
    subject_id: uuid.UUID | None = None,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return repo.list_folders(db, ctx.user.id, subject_id)


@router.post("/folders", response_model=FolderOut, status_code=201)
def create_folder(body: FolderIn, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.create_folder(db, ctx.user.id, body)


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: uuid.UUID, body: FolderUpdate,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update_folder(db, ctx.user.id, folder_id, body)


@router.delete("/folders/{folder_id}", status_code=204)
def delete_folder(folder_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete_folder(db, ctx.user.id, folder_id)
