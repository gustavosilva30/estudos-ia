"""Contrato entre os módulos de estudo e qualquer fornecedor de IA.

Os módulos de estudo só conhecem estas classes. Trocar de fornecedor/modelo = escrever
uma classe que implemente `LLMProvider` e registrá-la em `providers/__init__.py`.
"""

from dataclasses import dataclass
from typing import Any, Protocol


class ProviderError(Exception):
    """Falha do provedor. `retryable` indica se vale tentar de novo."""

    status = "error"
    retryable = False

    def __init__(self, message: str = "", detail: str = "") -> None:
        super().__init__(message)
        # Texto curto devolvido pelo fornecedor. Serve só para diagnóstico (log e `app.ai.check`);
        # nunca é mostrado ao usuário do app.
        self.detail = detail


class ProviderTimeout(ProviderError):
    status = "timeout"
    retryable = True


class ProviderRateLimited(ProviderError):
    status = "rate_limited"
    retryable = True


class ProviderUnavailable(ProviderError):
    """Falha transitória (rede, 5xx): vale repetir, mas não é limite de uso."""

    status = "error"
    retryable = True


@dataclass(frozen=True)
class LLMRequest:
    operation: str
    system: str  # regras da aplicação (confiáveis)
    user: str  # texto do usuário, já delimitado como dado NÃO confiável
    json_schema: dict[str, Any]  # formato exigido da resposta
    max_output_tokens: int
    timeout_seconds: float


@dataclass(frozen=True)
class LLMResponse:
    text: str  # JSON em texto
    model: str
    input_tokens: int | None = None  # None = o provedor não informou (usar estimativa)
    output_tokens: int | None = None


class LLMProvider(Protocol):
    name: str

    def complete(self, request: LLMRequest) -> LLMResponse: ...
