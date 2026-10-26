import uuid
from datetime import date, datetime
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.ai.profiles import CATEGORIES, DEFAULT_CATEGORY

MAX_MATERIAL_CHARS = 100_000
MAX_NOTE_CHARS = 20_000
MAX_OBSERVATIONS_CHARS = 5_000

T = TypeVar("T")


def _clean(v: str | None) -> str | None:
    return v.strip() if isinstance(v, str) else v


def _known_category(v: str | None) -> str | None:
    if v is not None and v not in CATEGORIES:
        raise ValueError("Categoria desconhecida.")
    return v


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# ---------- matérias ----------

class SubjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    description: str | None = Field(default=None, max_length=2000)
    category: str = Field(default=DEFAULT_CATEGORY, max_length=30)

    _strip = field_validator("name", "description", mode="before")(_clean)
    _category = field_validator("category")(_known_category)


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    description: str | None = Field(default=None, max_length=2000)
    is_archived: bool | None = None
    category: str | None = Field(default=None, max_length=30)

    _strip = field_validator("name", "description", mode="before")(_clean)
    _category = field_validator("category")(_known_category)


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: str | None
    description: str | None
    is_archived: bool
    category: str = DEFAULT_CATEGORY
    lesson_count: int = 0
    created_at: datetime
    updated_at: datetime


# ---------- pastas ----------

class FolderIn(BaseModel):
    subject_id: uuid.UUID
    parent_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=120)

    _strip = field_validator("name", mode="before")(_clean)


class FolderUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    parent_id: uuid.UUID | None = None  # enviar null move para a raiz

    _strip = field_validator("name", mode="before")(_clean)


class FolderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    subject_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    created_at: datetime
    updated_at: datetime


# ---------- textos e anotações ----------

class MaterialIn(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_MATERIAL_CHARS)
    origin: Literal["typed", "pasted", "formula"] = "typed"


class MaterialUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_MATERIAL_CHARS)


class MaterialOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    content: str
    content_hash: str
    origin: str
    source_name: str | None = None
    created_at: datetime
    updated_at: datetime


class LinkIn(BaseModel):
    url: str = Field(min_length=8, max_length=2000)


class NoteIn(BaseModel):
    content: str = Field(min_length=1, max_length=MAX_NOTE_CHARS)


class NoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    content: str
    created_at: datetime
    updated_at: datetime


# ---------- aulas ----------

class LessonIn(BaseModel):
    subject_id: uuid.UUID
    folder_id: uuid.UUID | None = None
    title: str = Field(min_length=1, max_length=200)
    lesson_date: date | None = None
    observations: str | None = Field(default=None, max_length=MAX_OBSERVATIONS_CHARS)
    # Texto original opcional: salvo antes de qualquer uso de IA.
    content: str | None = Field(default=None, max_length=MAX_MATERIAL_CHARS)
    origin: Literal["typed", "pasted"] = "typed"

    _strip = field_validator("title", "observations", mode="before")(_clean)


class LessonUpdate(BaseModel):
    subject_id: uuid.UUID | None = None
    folder_id: uuid.UUID | None = None  # presente no corpo e null = mover para a raiz
    title: str | None = Field(default=None, min_length=1, max_length=200)
    lesson_date: date | None = None
    observations: str | None = Field(default=None, max_length=MAX_OBSERVATIONS_CHARS)
    is_favorite: bool | None = None

    _strip = field_validator("title", "observations", mode="before")(_clean)


class LessonListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str | None
    folder_id: uuid.UUID | None
    lesson_date: date | None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime


class LessonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    subject_id: uuid.UUID
    folder_id: uuid.UUID | None
    lesson_date: date | None
    observations: str | None
    is_favorite: bool
    created_at: datetime
    updated_at: datetime


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lesson_id: uuid.UUID
    mime_type: str
    width: int
    height: int
    size_bytes: int
    created_at: datetime


class LessonDetail(LessonOut):
    materials: list[MaterialOut]
    notes: list[NoteOut]
    attachments: list[AttachmentOut] = []

