import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.lessons import _list_item
from app.config import Settings
from app.core.db import get_db
from app.core.deps import current_auth, get_app_settings
from app.schemas.ai import UsageOut
from app.schemas.library import LessonListItem
from app.services import dashboard as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


class Counts(BaseModel):
    subjects: int
    lessons: int
    materials: int
    summaries: int
    favorites: int


class Progress(BaseModel):
    lessons_total: int
    lessons_with_material: int
    lessons_with_summary: int
    percent_with_summary: int


class RecentSummary(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    lesson_title: str
    kind: str
    title: str
    is_favorite: bool
    updated_at: datetime


class Reviews(BaseModel):
    available: bool
    pending: int | None


class DashboardOut(BaseModel):
    counts: Counts
    progress: Progress
    recent_lessons: list[LessonListItem]
    recent_summaries: list[RecentSummary]
    reviews: Reviews
    ai_usage: UsageOut


@router.get("", response_model=DashboardOut)
def dashboard(
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_app_settings),
):
    data = svc.build(db, settings, ctx.user.id)
    data["recent_lessons"] = [_list_item(lesson, subject) for lesson, subject in data["recent_lessons"]]
    data["recent_summaries"] = [
        RecentSummary(
            id=s.id, lesson_id=s.lesson_id, lesson_title=title, kind=s.kind, title=s.title,
            is_favorite=s.is_favorite, updated_at=s.updated_at,
        )
        for s, title in data["recent_summaries"]
    ]
    return data
