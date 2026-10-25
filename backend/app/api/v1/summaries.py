import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import current_auth
from app.schemas.ai import SummaryCreate, SummaryListItem, SummaryOut, SummaryUpdate, VersionOut
from app.schemas.library import Page
from app.services import summaries as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/summaries", tags=["resumos"])


@router.get("", response_model=Page[SummaryListItem])
def list_summaries(
    lesson_id: uuid.UUID | None = None,
    favorite: bool | None = None,
    kind: str | None = Query(None, max_length=40),
    q: str | None = Query(None, max_length=200),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    rows, total = svc.list_summaries(
        db, ctx.user.id, lesson_id=lesson_id, favorite=favorite, kind=kind, q=q, page=page, page_size=page_size
    )
    return Page(items=[SummaryListItem.model_validate(r) for r in rows], total=total, page=page, page_size=page_size)


@router.post("", response_model=SummaryOut, status_code=201)
def create_summary(body: SummaryCreate, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.create_manual(db, ctx.user.id, body)


@router.get("/{summary_id}", response_model=SummaryOut)
def get_summary(summary_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.get(db, ctx.user.id, summary_id)


@router.patch("/{summary_id}", response_model=SummaryOut)
def update_summary(
    summary_id: uuid.UUID, body: SummaryUpdate,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.update(db, ctx.user.id, summary_id, body)


@router.delete("/{summary_id}", status_code=204)
def delete_summary(summary_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    svc.delete(db, ctx.user.id, summary_id)


@router.get("/{summary_id}/versions", response_model=list[VersionOut])
def list_versions(summary_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.versions(db, ctx.user.id, summary_id)


@router.post("/{summary_id}/versions/{number}/restore", response_model=SummaryOut)
def restore_version(
    summary_id: uuid.UUID, number: int,
    ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db),
):
    return svc.restore_version(db, ctx.user.id, summary_id, number)


@router.post("/{summary_id}/duplicate", response_model=SummaryOut, status_code=201)
def duplicate_summary(summary_id: uuid.UUID, ctx: AuthContext = Depends(current_auth), db: Session = Depends(get_db)):
    return svc.duplicate(db, ctx.user.id, summary_id)
