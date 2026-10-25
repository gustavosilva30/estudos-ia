import math
from decimal import Decimal

from app.config import Settings


def estimate_tokens(text: str) -> int:
    """Estimativa grosseira para português (~3,5 caracteres por token)."""
    return max(1, math.ceil(len(text) / 3.5))


def estimate_cost_usd(settings: Settings, input_tokens: int, output_tokens: int) -> Decimal:
    cost = (
        input_tokens * settings.ai_price_input_per_mtok + output_tokens * settings.ai_price_output_per_mtok
    ) / 1_000_000
    return Decimal(str(round(cost, 6)))
