"""Indicadores do dashboard. Tudo vem do banco, filtrado pelo usuário da sessão."""

import uuid

from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import Lesson, SourceMaterial, Subject, Summary
from app.repositories import library as repo
from app.services import ai as ai_service

RECENT = 5


def build(db: Session, settings: Settings, user_id: uuid.UUID) -> dict:
    def count(model, *where):
        return db.scalar(select(func.count()).select_from(model).where(model.user_id == user_id, *where)) or 0

    has_material = exists().where(SourceMaterial.lesson_id == Lesson.id, SourceMaterial.user_id == user_id)
    has_summary = exists().where(Summary.lesson_id == Lesson.id, Summary.user_id == user_id)
    lessons_total = count(Lesson)
    with_material = count(Lesson, has_material)
    with_summary = count(Lesson, has_summary)

    recent_lessons, _ = repo.search_lessons(db, user_id, repo.LessonFilters(), 1, RECENT)
    recent_summaries = db.execute(
        select(Summary, Lesson.title)
        .join(Lesson, (Lesson.id == Summary.lesson_id) & (Lesson.user_id == Summary.user_id))
        .where(Summary.user_id == user_id)
        .order_by(Summary.updated_at.desc(), Summary.id)
        .limit(RECENT)
    ).all()

    return {
        "counts": {
            "subjects": count(Subject, Subject.is_archived.is_(False)),
            "lessons": lessons_total,
            "materials": count(SourceMaterial),
            "summaries": count(Summary),
            "favorites": count(Lesson, Lesson.is_favorite.is_(True)) + count(Summary, Summary.is_favorite.is_(True)),
        },
        # Progresso = quantas aulas já têm texto salvo e quantas já têm resumo/material de estudo.
        "progress": {
            "lessons_total": lessons_total,
            "lessons_with_material": with_material,
            "lessons_with_summary": with_summary,
            "percent_with_summary": round(100 * with_summary / lessons_total) if lessons_total else 0,
        },
        "recent_lessons": recent_lessons,
        "recent_summaries": [(s, title) for s, title in recent_summaries],
        # O módulo de revisão (flashcards/perguntas) é da Fase 3: não há dado real a mostrar ainda.
        "reviews": {"available": False, "pending": None},
        "ai_usage": ai_service.usage_summary(db, settings, user_id),
    }
