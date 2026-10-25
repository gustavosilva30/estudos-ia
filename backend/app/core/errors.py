class AppError(Exception):
    """Erro de negócio com mensagem segura para o usuário (em português)."""

    def __init__(self, status_code: int, detail: str, headers: dict[str, str] | None = None):
        self.status_code = status_code
        self.detail = detail
        self.headers = headers
        super().__init__(detail)


class NotFound(AppError):
    def __init__(self, detail: str = "Recurso não encontrado."):
        super().__init__(404, detail)


class Unauthorized(AppError):
    def __init__(self, detail: str = "Não autenticado."):
        super().__init__(401, detail)


class Forbidden(AppError):
    def __init__(self, detail: str = "Acesso negado."):
        super().__init__(403, detail)


class TooManyRequests(AppError):
    def __init__(self, retry_after: int):
        super().__init__(
            429,
            "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
            {"Retry-After": str(retry_after)},
        )
