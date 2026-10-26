import re
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

KEY_PATTERN = re.compile(r"^(b:[a-z0-9-]{1,60}|c:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$")
NAME_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,15}$")
# Nomes que têm significado próprio no motor de cálculo: não podem ser variáveis.
RESERVED = {
    "pi", "e", "i", "ans", "deg", "rad", "true", "false", "Infinity", "NaN", "null", "undefined", "mod", "to",
    "and", "or", "not", "xor", "in", "end",
}
MAX_VARIABLES = 12

Category = Literal["matematica", "fisica", "quimica", "outra"]


def validate_key(key: str) -> str:
    if not KEY_PATTERN.match(key):
        raise ValueError("Fórmula inválida.")
    return key


class MarkIn(BaseModel):
    is_favorite: bool | None = None
    note: str | None = Field(default=None, max_length=5_000)


class MarkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    formula_key: str
    is_favorite: bool
    note: str | None
    updated_at: datetime


class VariableSpec(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=60)
    unit: str | None = Field(default=None, max_length=30)

    @field_validator("id")
    @classmethod
    def _id(cls, v: str) -> str:
        if not NAME_PATTERN.match(v) or v in RESERVED:
            raise ValueError("Nome de variável inválido: use letras, números e _ (começando por letra).")
        return v

    @field_validator("name", "unit")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return v.strip() if isinstance(v, str) else v


class CustomFormulaIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    category: Category = "outra"
    latex: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=2_000)
    variables: list[VariableSpec] = Field(default_factory=list, max_length=MAX_VARIABLES)
    expression: str = Field(min_length=1, max_length=300)
    result_name: str
    result_label: str = Field(default="resultado", min_length=1, max_length=60)
    result_unit: str | None = Field(default=None, max_length=30)

    @field_validator("title", "expression", "result_label")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Campo obrigatório.")
        return v

    @field_validator("result_name")
    @classmethod
    def _result(cls, v: str) -> str:
        if not NAME_PATTERN.match(v) or v in RESERVED:
            raise ValueError("Nome do resultado inválido: use letras, números e _ (começando por letra).")
        return v

    @model_validator(mode="after")
    def _unique(self) -> "CustomFormulaIn":
        ids = [v.id for v in self.variables]
        if len(set(ids)) != len(ids):
            raise ValueError("Há variáveis com o mesmo nome.")
        if self.result_name in ids:
            raise ValueError("O nome do resultado não pode repetir o de uma variável.")
        return self


class CustomFormulaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    category: str
    latex: str | None
    description: str | None
    variables: list[VariableSpec]
    expression: str
    result_name: str
    result_label: str
    result_unit: str | None
    created_at: datetime
    updated_at: datetime


class LessonFormulaIn(BaseModel):
    formula_key: str

    @field_validator("formula_key")
    @classmethod
    def _key(cls, v: str) -> str:
        return validate_key(v)


class LessonFormulaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    formula_key: str
    created_at: datetime


class FormulaLessonOut(BaseModel):
    """Aula à qual uma fórmula está vinculada."""

    lesson_id: uuid.UUID
    lesson_title: str
    subject_name: str
