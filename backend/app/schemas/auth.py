import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

Password = Field(min_length=10, max_length=128)


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Password
    display_name: str | None = Field(default=None, max_length=120)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v else None


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequestIn(BaseModel):
    email: EmailStr


class PasswordResetConfirmIn(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    new_password: str = Password


class ChangePasswordIn(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Password


class DeleteAccountIn(BaseModel):
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdateIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=120)

    @field_validator("display_name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        return (v.strip() or None) if v else None


class PreferencesIn(BaseModel):
    theme: Literal["light", "dark", "system"] | None = None
    default_detail_level: Literal["curto", "medio", "detalhado"] | None = None
    daily_ai_limit: int | None = Field(default=None, ge=0, le=200)


class PreferencesOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: str
    default_detail_level: str
    daily_ai_limit: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    display_name: str | None
    role: str
    created_at: datetime


class SessionOut(BaseModel):
    """Resposta de login/cadastro/perfil. O cliente reenvia csrf_token no cabeçalho X-CSRF-Token."""

    user: UserOut
    preferences: PreferencesOut
    csrf_token: str
