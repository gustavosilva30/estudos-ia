"""Fórmulas do usuário: favoritos e anotações, fórmulas próprias e vínculo com aulas.

O catálogo de fórmulas prontas fica no frontend; aqui só se guarda o que é da pessoa. Uma fórmula é
identificada por uma chave: `b:<id>` (do catálogo) ou `c:<uuid>` (própria).
"""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, IdMixin, TimestampMixin
from app.models.library import _user_fk


class FormulaMark(IdMixin, TimestampMixin, Base):
    """Favorito e/ou anotação pessoal sobre uma fórmula."""

    __tablename__ = "formula_marks"
    __table_args__ = (
        UniqueConstraint("user_id", "formula_key", name="uq_formula_marks_user_key"),
        CheckConstraint("length(formula_key) <= 80", name="chave_curta"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    formula_key: Mapped[str] = mapped_column(String(80), nullable=False)
    is_favorite: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    note: Mapped[str | None] = mapped_column(Text)


class CustomFormula(IdMixin, TimestampMixin, Base):
    """Fórmula criada pelo usuário. A conta (`expression`) só é avaliada no navegador, pelo motor da calculadora."""

    __tablename__ = "custom_formulas"
    __table_args__ = (
        UniqueConstraint("id", "user_id", name="uq_custom_formulas_id_user"),
        CheckConstraint("category IN ('matematica', 'fisica', 'quimica', 'outra')", name="categoria_valida"),
        CheckConstraint("length(title) > 0", name="titulo_nao_vazio"),
        Index("ix_custom_formulas_user", "user_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(12), nullable=False, server_default="outra")
    latex: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    # [{"id": "m", "name": "massa", "unit": "kg"}, ...]
    variables: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, server_default="[]")
    expression: Mapped[str] = mapped_column(String(300), nullable=False)
    result_name: Mapped[str] = mapped_column(String(16), nullable=False)
    result_label: Mapped[str] = mapped_column(String(60), nullable=False, server_default="resultado")
    result_unit: Mapped[str | None] = mapped_column(String(30))


class LessonFormula(IdMixin, Base):
    """Fórmula vinculada a uma aula (para consultar ou estudar junto com o conteúdo)."""

    __tablename__ = "lesson_formulas"
    __table_args__ = (
        UniqueConstraint("user_id", "lesson_id", "formula_key", name="uq_lesson_formulas_lesson_key"),
        ForeignKeyConstraint(
            ["lesson_id", "user_id"], ["lessons.id", "lessons.user_id"], ondelete="CASCADE",
            name="fk_lesson_formulas_lesson_user",
        ),
        Index("ix_lesson_formulas_lesson", "user_id", "lesson_id"),
        Index("ix_lesson_formulas_key", "user_id", "formula_key"),
    )

    user_id: Mapped[uuid.UUID] = _user_fk()
    lesson_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    formula_key: Mapped[str] = mapped_column(String(80), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
