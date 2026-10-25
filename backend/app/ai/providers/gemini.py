"""Provedor Google Gemini (Interactions API, GA desde jun/2026), via HTTP direto com httpx.

Referência: https://ai.google.dev/api/interactions-api
- Chave no cabeçalho `x-goog-api-key` (nunca na URL, para não aparecer em logs de proxy).
- `store: false`: o Google não guarda a interação para continuação posterior.
- Saída em JSON conforme o schema (`response_format`); a validação final é do Pydantic, aqui.
- Os tokens de "raciocínio" (thinking) contam como saída e consomem `max_output_tokens`:
  por isso o nível é configurável (AI_THINKING_LEVEL) e saída truncada é tratada como erro.
Nada do conteúdo do usuário nem da resposta é registrado em log.
"""

import logging
from typing import Any

import httpx

from app.ai.provider import (
    LLMRequest,
    LLMResponse,
    ProviderError,
    ProviderRateLimited,
    ProviderTimeout,
    ProviderUnavailable,
)
from app.config import Settings

log = logging.getLogger("estudos.ai.gemini")

# Palavras-chave de JSON Schema que mantemos. O restante (title, default, $defs, limites de
# tamanho...) é removido: o Gemini ignora parte delas e schemas grandes/aninhados podem dar 400.
# A validação completa (tamanhos, limites) é feita depois, pelo Pydantic.
_KEEP = ("type", "enum", "required", "description", "format")


def simplify_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Converte o JSON Schema do Pydantic em uma versão simples, sem $ref/$defs."""
    defs: dict[str, Any] = schema.get("$defs", {})

    def walk(node: Any) -> Any:
        if not isinstance(node, dict):
            return node
        if "$ref" in node:
            return walk(defs[node["$ref"].rsplit("/", 1)[-1]])
        out: dict[str, Any] = {k: node[k] for k in _KEEP if k in node}
        if "properties" in node:  # chaves de `properties` são NOMES de campos, não palavras-chave
            out["properties"] = {name: walk(sub) for name, sub in node["properties"].items()}
        if "items" in node:
            out["items"] = walk(node["items"])
        if "anyOf" in node:
            out["anyOf"] = [walk(sub) for sub in node["anyOf"]]
        return out

    return walk({k: v for k, v in schema.items() if k != "$defs"})


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str = "https://generativelanguage.googleapis.com",
        thinking_level: str = "",
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self._api_key = api_key
        self.model = model
        self._url = f"{base_url.rstrip('/')}/v1beta/interactions"
        self._thinking_level = thinking_level
        self._client = httpx.Client(transport=transport)

    @classmethod
    def from_settings(cls, settings: Settings) -> "GeminiProvider":
        key = settings.ai_api_key.get_secret_value() if settings.ai_api_key else ""
        if not key.strip():
            raise RuntimeError("AI_PROVIDER=gemini exige a variável AI_API_KEY (chave da API do Gemini).")
        return cls(
            api_key=key.strip(),
            model=settings.ai_model,
            base_url=settings.ai_api_base_url,
            thinking_level=settings.ai_thinking_level,
        )

    # ------------------------------------------------------------------
    def _body(self, request: LLMRequest) -> dict[str, Any]:
        config: dict[str, Any] = {"max_output_tokens": request.max_output_tokens}
        if self._thinking_level:
            config["thinking_level"] = self._thinking_level
        return {
            "model": self.model,
            "input": request.user,
            "system_instruction": request.system,
            "response_format": {
                "type": "text",
                "mime_type": "application/json",
                "schema": simplify_schema(request.json_schema),
            },
            "generation_config": config,
            "store": False,
        }

    def complete(self, request: LLMRequest) -> LLMResponse:
        timeout = httpx.Timeout(request.timeout_seconds, connect=min(10.0, request.timeout_seconds))
        try:
            response = self._client.post(
                self._url,
                json=self._body(request),
                headers={"x-goog-api-key": self._api_key},
                timeout=timeout,
            )
        except httpx.TimeoutException as exc:
            raise ProviderTimeout("Tempo esgotado ao chamar o Gemini.") from exc
        except httpx.HTTPError as exc:  # falha de rede/DNS/TLS; a mensagem pode ter a URL, sem a chave
            raise ProviderUnavailable(f"Falha de rede ao chamar o Gemini ({type(exc).__name__}).") from exc

        if response.status_code >= 400:
            raise self._http_error(response)
        return self._parse(response)

    # ------------------------------------------------------------------
    def _http_error(self, response: httpx.Response) -> ProviderError:
        message = ""
        try:
            message = str(response.json().get("error", {}).get("message", ""))[:200]
        except (ValueError, AttributeError):
            pass
        # Só código e mensagem do Google (que não contêm o conteúdo do usuário nem a chave).
        log.warning("gemini_http_error status=%s message=%r", response.status_code, message)
        code = response.status_code
        if code in (429, 503):  # limite de uso / modelo sobrecarregado
            return ProviderRateLimited(f"Gemini HTTP {code}")
        if code in (500, 502, 504):
            return ProviderUnavailable(f"Gemini HTTP {code}")
        # 400/401/403/404...: chave inválida, modelo inexistente ou pedido malformado. Repetir não resolve.
        return ProviderError(f"Gemini HTTP {code}")

    def _parse(self, response: httpx.Response) -> LLMResponse:
        try:
            data = response.json()
        except ValueError as exc:
            raise ProviderError("Resposta do Gemini não é JSON.") from exc
        if not isinstance(data, dict):
            raise ProviderError("Resposta do Gemini em formato inesperado.")

        status = data.get("status")
        if status == "incomplete":
            # Normalmente: limite de tokens atingido (talvez consumido pelo raciocínio).
            log.warning("gemini_incomplete model=%s", data.get("model"))
            raise ProviderError("Gemini devolveu a resposta incompleta (limite de tokens).")
        if status in ("failed", "cancelled"):
            raise ProviderUnavailable(f"Gemini terminou com status {status}.")

        texts: list[str] = []
        for step in data.get("steps") or []:
            if isinstance(step, dict) and step.get("type") == "model_output":
                for part in step.get("content") or []:
                    if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str):
                        texts.append(part["text"])
        if not texts:
            raise ProviderError("Gemini não devolveu texto (possível bloqueio de segurança).")

        usage = data.get("usage") or {}
        tokens_in = _int(usage.get("total_input_tokens"))
        total = _int(usage.get("total_tokens"))
        if total is not None and tokens_in is not None and total >= tokens_in:
            tokens_out: int | None = total - tokens_in  # saída + raciocínio, como é cobrado
        else:
            out, thought = _int(usage.get("total_output_tokens")), _int(usage.get("total_thought_tokens"))
            tokens_out = None if out is None and thought is None else (out or 0) + (thought or 0)

        return LLMResponse(
            text="".join(texts),
            model=str(data.get("model") or self.model),
            input_tokens=tokens_in,
            output_tokens=tokens_out,
        )


def _int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) and value >= 0 else None
