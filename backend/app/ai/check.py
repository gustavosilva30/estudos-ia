"""Diagnóstico da IA: faz UMA chamada pequena ao provedor configurado e diz se está funcionando.

Uso (no console do serviço backend, com as variáveis de ambiente já configuradas):

    python -m app.ai.check

Não toca no banco, não registra nada e nunca imprime a chave. Gasta alguns centavos de token
(texto de ~1 frase). Saída 0 = ok, 1 = falhou.
"""

import sys

from pydantic import ValidationError

from app.ai.operations import OPERATIONS, build_system_prompt, build_user_message
from app.ai.provider import LLMRequest, ProviderError
from app.ai.providers import build_provider
from app.config import get_settings

SAMPLE = "A fotossíntese converte luz solar em energia química nos cloroplastos das plantas."


def main() -> int:
    settings = get_settings()
    print(f"Provedor: {settings.ai_provider} | modelo: {settings.ai_model} | "
          f"raciocínio: {settings.ai_thinking_level or '(padrão do modelo)'}")
    try:
        provider = build_provider(settings)
    except RuntimeError as exc:
        print(f"ERRO de configuração: {exc}")
        return 1

    op = OPERATIONS["resumo_rapido"]
    request = LLMRequest(
        operation=op.id,
        system=build_system_prompt(op, "medio"),
        user=build_user_message(SAMPLE),
        json_schema=op.result_model.model_json_schema(),
        max_output_tokens=settings.ai_max_output_tokens,
        timeout_seconds=settings.ai_timeout_seconds,
    )
    try:
        response = provider.complete(request)
    except ProviderError as exc:
        print(f"ERRO ao chamar a IA [{exc.status}]: {exc}")
        print("Dicas: 400/401/403 = chave inválida ou sem permissão; 404 = nome do modelo incorreto; "
              "429 = limite/cota; 'incompleta' = aumente AI_MAX_OUTPUT_TOKENS ou reduza AI_THINKING_LEVEL.")
        return 1

    try:
        op.result_model.model_validate_json(response.text)
    except ValidationError:
        print("ERRO: a IA respondeu, mas fora do formato esperado (JSON do schema).")
        return 1

    print(f"OK: resposta válida do modelo {response.model} "
          f"(tokens de entrada: {response.input_tokens}, de saída: {response.output_tokens}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
