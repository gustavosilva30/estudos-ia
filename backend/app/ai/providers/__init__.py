"""Registro de provedores. Para adicionar um (ex.: Anthropic, OpenAI): criar a classe em um novo
arquivo desta pasta, implementando `LLMProvider`, e incluí-la em PROVIDERS."""

from collections.abc import Callable

from app.ai.provider import LLMProvider
from app.ai.providers.fake import FakeProvider
from app.config import Settings

PROVIDERS: dict[str, Callable[[Settings], LLMProvider]] = {
    "fake": lambda s: FakeProvider(model=s.ai_model),
}


def build_provider(settings: Settings) -> LLMProvider:
    try:
        return PROVIDERS[settings.ai_provider](settings)
    except KeyError:
        known = ", ".join(sorted(PROVIDERS))
        raise RuntimeError(
            f"AI_PROVIDER={settings.ai_provider!r} não está implementado. Opções: {known}."
        ) from None
