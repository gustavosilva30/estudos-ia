"""Gerações de IA, consumo/custos e resumos editáveis com versões."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Computed,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin


def _user_fk() -> Mapped[uuid.UUID]:
    return mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )


class AIGeneration(IdMixin, TimestampMixin, Base):
    """Resultado estruturado de uma operação de IA sobre um texto original OU uma imagem.
    As chaves únicas impedem chamadas duplicadas (mesma origem, operação, nível, prompt e modelo)."""

    __tablename__ = "ai_generations"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_ai_generations_id_user"),
        UniqueConstraint(
            "user_id", "material_id", "operation", "detail_level", "input_hash",
            name="uq_ai_generations_dedup",
        ),
        UniqueConstraint(
            "user_id", "attachment_id", "operation", "detail_level", "input_hash",
            name="uq_ai_generations_dedup_attachment",
        ),
        ForeignKeyConstraint(
            ["material_id", "user_id"], ["source_materials.id", "source_materials.user_id"],
            ondelete="CASCADE", name="fk_ai_generations_material_user",
        ),
        ForeignKeyConstraint(
            ["attachment_id", "user_id"], ["attachments.id", "attachments.user_id"],
            ondelete="CASCADE", name="fk_ai_generations_attachment_user",
        ),
        # Exatamente uma origem: um texto salvo ou uma imagem.
        CheckConstraint("num_nonnulls(material_id, attachment_id) = 1", name="uma_origem"),
        Index("ix_ai_generations_user_created", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    material_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    operation: Mapped[str] = mapped_column(String(40), nullable=False)
    detail_level: Mapped[str] = mapped_column(String(12), nullable=False)
    input_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    result: Mapped[dict] = mapped_column(JSONB, nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, server_default="0")


class AIUsageLog(IdMixin, Base):
    """Uma linha por chamada ao provedor (inclusive falhas). Nunca guarda o conteúdo do usuário."""

    __tablename__ = "ai_usage_logs"
    __table_args__ = (
        CheckConstraint(
            "status IN ('ok', 'timeout', 'rate_limited', 'error', 'invalid_output')", name="status_valido"
        ),
        Index("ix_ai_usage_logs_user_created", "user_id", "created_at"),
        Index("ix_ai_usage_logs_created", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    generation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_generations.id", ondelete="SET NULL")
    )
    operation: Mapped[str] = mapped_column(String(40), nullable=False)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)
    model: Mapped[str] = mapped_column(String(80), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    estimated_cost_usd: Mapped[Decimal] = mapped_column(Numeric(12, 6), nullable=False, server_default="0")
    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    # clock_timestamp(): instante real da chamada, distinto mesmo dentro de uma mesma transação.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("clock_timestamp()"), nullable=False
    )


class Summary(IdMixin, TimestampMixin, Base):
    """Material de estudo editável (em Markdown). Nunca substitui o texto original."""

    __tablename__ = "summaries"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_summaries_id_user"),
        ForeignKeyConstraint(
            ["lesson_id", "user_id"], ["lessons.id", "lessons.user_id"], ondelete="CASCADE",
            name="fk_summaries_lesson_user",
        ),
        # Se a geração de origem for apagada, só generation_id vira NULL (user_id é preservado).
        ForeignKeyConstraint(
            ["generation_id", "user_id"], ["ai_generations.id", "ai_generations.user_id"],
            ondelete="SET NULL (generation_id)", name="fk_summaries_generation_user",
        ),
        CheckConstraint("length(trim(title)) > 0", name="titulo_nao_vazio"),
        CheckConstraint("current_version >= 1", name="versao_positiva"),
        Index("ix_summaries_user_updated", "user_id", "updated_at"),
        Index("ix_summaries_lesson", "user_id", "lesson_id"),
        Index("ix_summaries_search", "search_vector", postgresql_using="gin"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    generation_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    kind: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # versão atual
    current_version: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR,
        Computed("to_tsvector('portuguese', coalesce(title, '') || ' ' || coalesce(content, ''))", persisted=True),
    )


class SummaryVersion(IdMixin, Base):
    """Histórico imutável: cada alteração de conteúdo gera uma nova versão."""

    __tablename__ = "summary_versions"
    __table_args__ = (
        UniqueConstraint("summary_id", "version_number", name="uq_summary_versions_number"),
        ForeignKeyConstraint(
            ["summary_id", "user_id"], ["summaries.id", "summaries.user_id"], ondelete="CASCADE",
            name="fk_summary_versions_summary_user",
        ),
        CheckConstraint("origin IN ('ai', 'user', 'duplicate')", name="origem_valida"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    summary_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    origin: Mapped[str] = mapped_column(String(10), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
