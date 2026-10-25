"""Primitivas de segurança. Usa bibliotecas padrão (argon2-cffi, secrets, hashlib); nada caseiro."""

import hashlib
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

_hasher = PasswordHasher()  # Argon2id com parâmetros padrão da biblioteca
# Hash descartável: permite gastar o mesmo tempo quando o e-mail não existe.
_DUMMY_HASH = _hasher.hash("senha-descartavel-para-equalizar-tempo")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_dummy(password: str) -> None:
    verify_password(_DUMMY_HASH, password)


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_token() -> str:
    """Token aleatório de 256 bits, seguro para URL/cookie."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Só o hash dos tokens (sessão, recuperação) é guardado no banco."""
    return hashlib.sha256(token.encode()).hexdigest()


def safe_equal(a: str, b: str) -> bool:
    return secrets.compare_digest(a.encode(), b.encode())
