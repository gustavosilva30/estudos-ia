"""Download seguro de páginas públicas (links informados pelo usuário).

Qualquer endereço que o usuário digite faz o SERVIDOR abrir uma conexão: sem cuidado, isso daria acesso à rede
interna (banco de dados, painel da VPS, metadados da nuvem). Por isso:
- só http/https, nas portas 80 e 443, sem usuário/senha na URL;
- o nome é resolvido por nós e CADA endereço IP é conferido (só IPs públicos); a conexão vai para o IP já
  conferido, o que impede "DNS rebinding" (nome que muda de resposta entre a conferência e a conexão);
- redirecionamentos são seguidos manualmente (até 3) e cada destino passa pelas mesmas regras;
- tamanho e tempo limitados; variáveis de proxy do ambiente são ignoradas.
"""

import ipaddress
import socket
import time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urljoin, urlsplit

import httpcore
import httpx

from app.core.errors import AppError

ALLOWED_PORTS = {80, 443}
MAX_REDIRECTS = 3
USER_AGENT = "EstudosIA/1.0 (leitura de links enviados pelo usuario)"
TEXT_TYPES = ("text/html", "application/xhtml+xml", "text/plain", "text/markdown")
UNREACHABLE = "Não consegui abrir este link. Confira o endereço e se a página é pública."


def _check_ip(ip: str) -> None:
    address = ipaddress.ip_address(ip)
    if not address.is_global or (address.version == 6 and address.ipv4_mapped is not None and not address.ipv4_mapped.is_global):
        raise AppError(400, "Este endereço não é permitido: só páginas públicas da internet podem ser lidas.")


def resolve_public(host: str, port: int) -> list[str]:
    """Resolve o nome e devolve só IPs públicos. Se QUALQUER resposta for privada, recusa tudo."""
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise AppError(400, UNREACHABLE) from None
    ips = list(dict.fromkeys(info[4][0] for info in infos))
    if not ips:
        raise AppError(400, UNREACHABLE)
    for ip in ips:
        _check_ip(ip)
    return ips


class _PublicOnlyBackend(httpcore.SyncBackend):
    """Backend de rede do httpcore que só conecta a IPs públicos, usando o IP conferido."""

    def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        last: Exception | None = None
        for ip in resolve_public(host, port):
            try:
                return super().connect_tcp(ip, port, timeout=timeout, local_address=local_address, socket_options=socket_options)
            except httpcore.ConnectError as exc:
                last = exc
        raise last or httpcore.ConnectError(UNREACHABLE)


def build_transport() -> httpx.HTTPTransport:
    transport = httpx.HTTPTransport(retries=0)
    # httpx não expõe o backend de rede; troca o pool por um equivalente com o backend restrito.
    transport._pool = httpcore.ConnectionPool(
        ssl_context=httpx.create_ssl_context(), max_connections=4, network_backend=_PublicOnlyBackend(), http2=False,
    )
    return transport


def validate_url(url: str) -> httpx.URL:
    """Confere o formato da URL (sem rede). Levanta AppError 400 se não for permitida."""
    try:
        parts = urlsplit(url.strip())
        port = parts.port
    except ValueError:
        raise AppError(400, "Endereço inválido.") from None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        raise AppError(400, "Use um endereço que comece com http:// ou https://.")
    if parts.username or parts.password:
        raise AppError(400, "O endereço não pode conter usuário ou senha.")
    effective = port or (443 if parts.scheme == "https" else 80)
    if effective not in ALLOWED_PORTS:
        raise AppError(400, "Este endereço usa uma porta não permitida.")
    host = parts.hostname
    try:  # IP escrito direto na URL: confere já
        _check_ip(host)
    except ValueError:
        pass
    return httpx.URL(parts._replace(fragment="").geturl())


@dataclass
class Fetched:
    url: str
    content_type: str
    body: bytes


def fetch_public(
    url: str, *, max_bytes: int, timeout: float, transport: httpx.BaseTransport | None = None,
    clock: Callable[[], float] = time.monotonic,
) -> Fetched:
    """Baixa o conteúdo de um link público. Redirecionamentos e tamanho são controlados aqui."""
    current = validate_url(url)
    deadline = clock() + timeout
    with httpx.Client(
        transport=transport or build_transport(), timeout=httpx.Timeout(timeout), follow_redirects=False,
        trust_env=False, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/pdf,text/plain;q=0.9,*/*;q=0.1"},
    ) as client:
        for _ in range(MAX_REDIRECTS + 1):
            try:
                with client.stream("GET", current) as response:
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise AppError(502, UNREACHABLE)
                        current = validate_url(urljoin(str(current), location))
                        continue
                    if response.status_code in (401, 403):
                        raise AppError(422, "A página exige login ou bloqueou o acesso. Cole o texto manualmente.")
                    if response.status_code == 404:
                        raise AppError(422, "A página não foi encontrada (erro 404).")
                    if response.status_code >= 400:
                        raise AppError(502, f"A página respondeu com erro {response.status_code}.")
                    declared = response.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > max_bytes:
                        raise AppError(413, "O conteúdo do link é grande demais.")
                    chunks: list[bytes] = []
                    size = 0
                    for chunk in response.iter_bytes():
                        size += len(chunk)
                        if size > max_bytes:
                            raise AppError(413, "O conteúdo do link é grande demais.")
                        if clock() > deadline:
                            raise AppError(504, "O link demorou demais para responder.")
                        chunks.append(chunk)
                    ctype = response.headers.get("content-type", "").split(";")[0].strip().lower()
                    return Fetched(str(current), ctype, b"".join(chunks))
            except httpx.TimeoutException:
                raise AppError(504, "O link demorou demais para responder.") from None
            except (httpx.HTTPError, httpcore.ConnectError, OSError):
                raise AppError(502, UNREACHABLE) from None
    raise AppError(502, "O link redireciona vezes demais.")
