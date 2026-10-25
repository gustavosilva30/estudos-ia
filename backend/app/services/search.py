"""Pesquisa global: matérias (nome), aulas (título e textos originais) e resumos (título e conteúdo).
Todas as consultas são filtradas pelo usuário da sessão."""

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Lesson, Subject, Summary
from app.repositories import library as repo

LIMIT = 8
HEADLINE_OPTIONS = "MaxWords=22,MinWords=8,MaxFragments=1,StartSel=<<,StopSel=>>"


def search_all(db: Session, user_id: uuid.UUID, q: str) -> dict:
    q = q.strip()
    like = f"%{repo._like_escape(q)}%"

    subjects = list(db.scalars(
        select(Subject)
        .where(Subject.user_id == user_id, Subject.name.ilike(like, escape="\\"))
        .order_by(Subject.is_archived, func.lower(Subject.name))
        .limit(LIMIT)
    ))

    lessons, lessons_total = repo.search_lessons(
        db, user_id, repo.LessonFilters(q=q), page=1, page_size=LIMIT
    )

    tsq = func.websearch_to_tsquery("portuguese", q)
    match = or_(Summary.search_vector.op("@@")(tsq), Summary.title.ilike(like, escape="\\"))
    summaries_total = db.scalar(
        select(func.count()).select_from(Summary).where(Summary.user_id == user_id, match)
    ) or 0
    summary_rows = db.execute(
        select(Summary, Lesson.title, func.ts_headline("portuguese", Summary.content, tsq, HEADLINE_OPTIONS))
        .join(Lesson, (Lesson.id == Summary.lesson_id) & (Lesson.user_id == Summary.user_id))
        .where(Summary.user_id == user_id, match)
        .order_by(Summary.updated_at.desc(), Summary.id)
        .limit(LIMIT)
    ).all()

    return {
        "query": q,
        "subjects": subjects,
        "lessons": lessons,
        "lessons_total": lessons_total,
        "summaries": summary_rows,
        "summaries_total": summaries_total,
    }
