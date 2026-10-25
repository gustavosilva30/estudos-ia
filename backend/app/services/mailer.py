"""Envio de e-mail. Ainda não há SMTP configurado.

Em desenvolvimento/teste o link de recuperação é escrito no log do servidor.
Em produção sem SMTP nada é enviado e o token NUNCA é registrado em log.
"""

import logging
from typing import Protocol

from app.config import Settings

log = logging.getLogger("estudos.mailer")


class Mailer(Protocol):
    def send_password_reset(self, to_email: str, token: str) -> None: ...


class ConsoleMailer:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send_password_reset(self, to_email: str, token: str) -> None:
        if self._settings.is_production:
            log.warning("Recuperação de senha solicitada, mas o SMTP não está configurado.")
            return
        link = f"{self._settings.frontend_url}/redefinir-senha?token={token}"
        log.warning("[DEV] Link de recuperação para %s: %s", to_email, link)
