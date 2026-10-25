"""Biblioteca: matérias, pastas, aulas, textos originais e anotações.

Isolamento por usuário no próprio banco: toda tabela tem user_id e as chaves
estrangeiras entre tabelas privadas são compostas (id, user_id). Assim o
PostgreSQL recusa, por exemplo, ligar uma aula do usuário A a uma matéria do B.
"""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )


class Subject(IdMixin, TimestampMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_subjects_id_user"),
        UniqueConstraint("user_id", "name", name="uq_subjects_user_name"),
        CheckConstraint("length(trim(name)) > 0", name="nome_nao_vazio"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    color: Mapped[str | None] = mapped_column(String(7))
    description: Mapped[str | None] = mapped_column(Text)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # Área de conhecimento (ver app/ai/profiles.py): muda como a IA resume, explica e resolve.
    # Validada na aplicação (lista de categorias evolui sem migration).
    category: Mapped[str] = mapped_column(String(30), nullable=False, server_default="outro")


class Folder(IdMixin, TimestampMixin, Base):
    __tablename__ = "folders"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_folders_id_user"),
        ForeignKeyConstraint(
            ["subject_id", "user_id"], ["subjects.id", "subjects.user_id"], ondelete="CASCADE",
            name="fk_folders_subject_user",
        ),
        ForeignKeyConstraint(
            ["parent_id", "user_id"], ["folders.id", "folders.user_id"], name="fk_folders_parent_user",
        ),
        CheckConstraint("length(trim(name)) > 0", name="nome_nao_vazio"),
        CheckConstraint("parent_id IS NULL OR parent_id <> id", name="sem_auto_pai"),
        Index("ix_folders_user_subject", "user_id", "subject_id"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    name: Mapped[str] = mapped_column(String(120), nullable=False)


class Lesson(IdMixin, TimestampMixin, Base):
    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_lessons_id_user"),
        ForeignKeyConstraint(
            ["subject_id", "user_id"], ["subjects.id", "subjects.user_id"], ondelete="CASCADE",
            name="fk_lessons_subject_user",
        ),
        ForeignKeyConstraint(
            ["folder_id", "user_id"], ["folders.id", "folders.user_id"], name="fk_lessons_folder_user",
        ),
        CheckConstraint("length(trim(title)) > 0", name="titulo_nao_vazio"),
        Index("ix_lessons_user_updated", "user_id", "updated_at"),
        Index("ix_lessons_user_subject", "user_id", "subject_id"),
        Index("ix_lessons_search", "search_vector", postgresql_using="gin"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    folder_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    lesson_date: Mapped[date | None] = mapped_column(Date)
    observations: Mapped[str | None] = mapped_column(Text)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('portuguese', coalesce(title, ''))", persisted=True)
    )


class SourceMaterial(IdMixin, TimestampMixin, Base):
    """Texto original do usuário. Nunca é sobrescrito por resultados de IA."""

    __tablename__ = "source_materials"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_source_materials_id_user"),
        ForeignKeyConstraint(
            ["lesson_id", "user_id"], ["lessons.id", "lessons.user_id"], ondelete="CASCADE",
            name="fk_source_materials_lesson_user",
        ),
        CheckConstraint("origin IN ('typed', 'pasted', 'image')", name="origem_valida"),
        CheckConstraint("length(content) > 0", name="conteudo_nao_vazio"),
        Index("ix_source_materials_lesson", "user_id", "lesson_id"),
        Index("ix_source_materials_search", "search_vector", postgresql_using="gin"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    # SHA-256 do conteúdo: usado para evitar chamadas de IA duplicadas.
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    origin: Mapped[str] = mapped_column(String(10), nullable=False, server_default="typed")
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('portuguese', coalesce(content, ''))", persisted=True)
    )


class Note(IdMixin, TimestampMixin, Base):
    __tablename__ = "notes"
    __table_args__ = (
        ForeignKeyConstraint(
            ["lesson_id", "user_id"], ["lessons.id", "lessons.user_id"], ondelete="CASCADE",
            name="fk_notes_lesson_user",
        ),
        Index("ix_notes_lesson", "user_id", "lesson_id"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)


class Attachment(IdMixin, Base):
    """Imagem enviada pelo usuário (já validada, sem metadados, reduzida e recodificada).
    Pertence a uma aula; os bytes ficam no PostgreSQL (e portanto no backup)."""

    __tablename__ = "attachments"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_attachments_id_user"),
        UniqueConstraint("user_id", "lesson_id", "sha256", name="uq_attachments_lesson_sha"),
        ForeignKeyConstraint(
            ["lesson_id", "user_id"], ["lessons.id", "lessons.user_id"], ondelete="CASCADE",
            name="fk_attachments_lesson_user",
        ),
        CheckConstraint("kind IN ('image')", name="tipo_valido"),
        CheckConstraint("mime_type IN ('image/jpeg', 'image/png', 'image/webp')", name="mime_valido"),
        CheckConstraint("size_bytes > 0", name="tamanho_positivo"),
        Index("ix_attachments_lesson", "user_id", "lesson_id"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    kind: Mapped[str] = mapped_column(String(10), nullable=False, server_default="image")
    mime_type: Mapped[str] = mapped_column(String(30), nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    # deferred: listar anexos não carrega os bytes.
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
