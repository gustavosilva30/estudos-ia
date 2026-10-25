from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuração lida de variáveis de ambiente (veja .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = Field(default="development", pattern="^(development|production|test)$")
    database_url: str = "postgresql+psycopg://estudos:troque-esta-senha@127.0.0.1:5432/estudos"
    secret_key: str = "troque-por-um-valor-aleatorio-longo"
    allowed_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    frontend_url: str = "http://localhost:3000"
    max_body_bytes: int = 1_000_000

    # Autenticação
    registration_enabled: bool = True
    session_cookie_name: str = "estudos_session"
    session_ttl_hours: int = 168  # expira após 7 dias sem uso
    session_absolute_days: int = 30  # limite máximo desde o login
    password_reset_ttl_minutes: int = 30

    # Limites de tentativas (janela de 15 minutos)
    rate_limit_login_pair: int = 5  # por e-mail + IP
    rate_limit_login_email: int = 20  # por e-mail, qualquer IP
    rate_limit_login_ip: int = 30  # por IP
    rate_limit_register_ip: int = 10
    rate_limit_reset_ip: int = 10
    rate_limit_window_seconds: int = 900

    # IA (camada independente de fornecedor)
    ai_provider: str = "fake"
    ai_api_key: SecretStr | None = None
    ai_model: str = "fake-1"
    ai_timeout_seconds: float = 60
    ai_max_input_chars: int = 60_000
    ai_max_output_tokens: int = 2_000
    ai_max_retries: int = 2  # tentativas extras em erros transitórios
    ai_retry_backoff_seconds: float = 0.5
    ai_rate_limit_per_minute: int = 6  # por usuário
    ai_monthly_budget_usd: float = 10.0  # 0 = sem limite; soma de todos os usuários
    ai_price_input_per_mtok: float = 0.0  # USD por milhão de tokens (preencha conforme o modelo)
    ai_price_output_per_mtok: float = 0.0

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
