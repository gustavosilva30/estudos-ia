import math
from decimal import Decimal

from app.config import Settings


def estimate_tokens(text: str) -> int:
    """Estimativa grosseira para português (~3,5 caracteres por token)."""
    return max(1, math.ceil(len(text) / 3.5))


def estimate_cost_usd(settings: Settings, input_tokens: int, output_tokens: int, *, strong: bool = False) -> Decimal:
    price_in, price_out = settings.ai_price_input_per_mtok, settings.ai_price_output_per_mtok
    if strong:  # modelo forte: preço próprio, se configurado
        if settings.ai_price_input_per_mtok_strong is not None:
            price_in = settings.ai_price_input_per_mtok_strong
        if settings.ai_price_output_per_mtok_strong is not None:
            price_out = settings.ai_price_output_per_mtok_strong
    cost = (input_tokens * price_in + output_tokens * price_out) / 1_000_000
    return Decimal(str(round(cost, 6)))
