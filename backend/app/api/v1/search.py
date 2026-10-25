import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.v1.lessons import _list_item
from app.core.db import get_db
from app.core.deps import current_auth
from app.schemas.library import LessonListItem
from app.services import search as svc
from app.services.auth import AuthContext

router = APIRouter(prefix="/api/v1/search", tags=["pesquisa"])


class SubjectHit(BaseModel):
    id: uuid.UUID
    name: str
    color: str | None
    is_archived: bool


class SummaryHit(BaseModel):
    id: uuid.UUID
    lesson_id: uuid.UUID
    lesson_title: str
    title: str
    kind: str
    # Trecho do conteúdo; os termos encontrados vêm entre << e >> (texto puro, nunca HTML).
    snippet: str
    updated_at: datetime


class SearchOut(BaseModel):
    query: str
    subjects: list[SubjectHit]
    lessons: list[LessonListItem]
    lessons_total: int
    summaries: list[SummaryHit]
    summaries_total: int


@router.get("", response_model=SearchOut)
def search(
    q: str = Query(min_length=2, max_length=200),
    ctx: AuthContext = Depends(current_auth),
    db: Session = Depends(get_db),
):
    data = svc.search_all(db, ctx.user.id, q)
    return SearchOut(
        query=data["query"],
        subjects=[SubjectHit(id=s.id, name=s.name, color=s.color, is_archived=s.is_archived) for s in data["subjects"]],
        lessons=[_list_item(lesson, subject) for lesson, subject in data["lessons"]],
        lessons_total=data["lessons_total"],
        summaries=[
            SummaryHit(
                id=s.id, lesson_id=s.lesson_id, lesson_title=lesson_title, title=s.title, kind=s.kind,
                snippet=snippet, updated_at=s.updated_at,
            )
            for s, lesson_title, snippet in data["summaries"]
        ],
        summaries_total=data["summaries_total"],
    )
