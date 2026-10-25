"""Imagens das aulas. Sempre filtradas pelo usuário da sessão; recurso de outro usuário responde 404."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session, undefer

from app.config import Settings
from app.core.errors import AppError, NotFound
from app.models import Attachment, Lesson
from app.repositories import library as repo
from app.services.images import process_upload


def upload(db: Session, settings: Settings, user_id: uuid.UUID, lesson_id: uuid.UUID, raw: bytes) -> Attachment:
    lesson = repo.get_owned(db, Lesson, user_id, lesson_id)
    if lesson is None:
        raise NotFound("Aula não encontrada.")
    if len(raw) > settings.max_upload_bytes:
        raise AppError(413, f"A imagem passa de {settings.max_upload_bytes // 1_000_000} MB. Reduza o tamanho e tente de novo.")

    image = process_upload(raw)  # valida o conteúdo real, remove metadados, reduz e recodifica

    existing = db.scalar(select(Attachment).where(
        Attachment.user_id == user_id, Attachment.lesson_id == lesson.id, Attachment.sha256 == image.sha256
    ))
    if existing is not None:  # mesma imagem de novo na mesma aula: reaproveita
        return existing

    count, used = db.execute(
        select(func.count(), func.coalesce(func.sum(Attachment.size_bytes), 0)).where(Attachment.user_id == user_id)
    ).one()
    per_lesson = db.scalar(
        select(func.count()).select_from(Attachment).where(Attachment.user_id == user_id, Attachment.lesson_id == lesson.id)
    ) or 0
    if per_lesson >= settings.max_attachments_per_lesson:
        raise AppError(409, f"Esta aula já tem {settings.max_attachments_per_lesson} imagens (o máximo). Exclua alguma para enviar outra.")
    if used + len(image.data) > settings.max_user_storage_bytes:
        raise AppError(409, "O limite de espaço para imagens da sua conta foi atingido. Exclua imagens antigas.")

    attachment = Attachment(
        user_id=user_id, lesson_id=lesson.id, kind="image", mime_type=image.mime_type, width=image.width,
        height=image.height, size_bytes=len(image.data), sha256=image.sha256, data=image.data,
    )
    db.add(attachment)
    db.commit()
    del count
    return attachment


def get_with_data(db: Session, user_id: uuid.UUID, attachment_id: uuid.UUID) -> Attachment:
    attachment = db.scalar(
        select(Attachment)
        .options(undefer(Attachment.data))
        .where(Attachment.id == attachment_id, Attachment.user_id == user_id)
    )
    if attachment is None:
        raise NotFound("Imagem não encontrada.")
    return attachment


def delete(db: Session, user_id: uuid.UUID, attachment_id: uuid.UUID) -> None:
    attachment = repo.get_owned(db, Attachment, user_id, attachment_id)
    if attachment is None:
        raise NotFound("Imagem não encontrada.")
    db.delete(attachment)  # apaga também as gerações de IA feitas a partir dela; resumos salvos permanecem
    db.commit()
