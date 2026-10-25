import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ai.operations import DetailLevel
from app.schemas.library import MAX_MATERIAL_CHARS


class OperationOut(BaseModel):
    id: str
    label: str
    description: str
    supports_detail: bool
    inputs: list[str]  # "material" (texto salvo) e/ou "attachment" (imagem)


class OperationsOut(BaseModel):
    operations: list[OperationOut]
    max_input_chars: int


class GenerateIn(BaseModel):
    # Exatamente um dos dois: um texto salvo da aula ou uma imagem enviada.
    material_id: uuid.UUID | None = None
    attachment_id: uuid.UUID | None = None
    operation: str = Field(min_length=1, max_length=40)
    detail_level: DetailLevel | None = None  # None = preferência do usuário
    force: bool = False  # True = ignora o cache e gera de novo (consome cota)


class GenerationOut(BaseModel):
    id: uuid.UUID
    material_id: uuid.UUID | None
    attachment_id: uuid.UUID | None
    lesson_id: uuid.UUID
    operation: str
    operation_label: str
    detail_level: str
    provider: str
    model: str
    result: dict[str, Any]
    markdown: str
    input_tokens: int
    output_tokens: int
    estimated_cost_usd: float
    created_at: datetime
    cached: bool


class UsageOut(BaseModel):
    used_today: int
    daily_limit: int
    month_cost_usd: float
    monthly_budget_usd: float


class SaveGenerationIn(BaseModel):
    title: str | None = Field(default=None, max_length=200)

    @field_validator("title", mode="before")
    @classmethod
    def _strip(cls, v):
        return (v.strip() or None) if isinstance(v, str) else v


class SaveAsMaterialIn(BaseModel):
    # Texto revisado pela pessoa. Vazio/ausente = usar a transcrição da IA como está.
    content: str | None = Field(default=None, min_length=1, max_length=MAX_MATERIAL_CHARS)


class SummaryCreate(BaseModel):
    lesson_id: uuid.UUID
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=MAX_MATERIAL_CHARS)

    @field_validator("title", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class SummaryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    content: str | None = Field(default=None, min_length=1, max_length=MAX_MATERIAL_CHARS)
    is_favorite: bool | None = None

    @field_validator("title", mode="before")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class SummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    generation_id: uuid.UUID | None
    kind: str
    title: str
    content: str
    current_version: int
    is_favorite: bool
    created_at: datetime
    updated_at: datetime


class SummaryListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    kind: str
    title: str
    current_version: int
    is_favorite: bool
    updated_at: datetime


class VersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    version_number: int
    title: str
    content: str
    origin: str
    created_at: datetime
