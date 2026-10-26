"""Extração de texto de documentos (PDF) e de páginas web, para virar texto original da aula.

O arquivo em si não é guardado: só o texto extraído, que a pessoa pode revisar e editar.
"""

import io
import logging
import re
from html.parser import HTMLParser

from pypdf import PdfReader
from pypdf.errors import PyPdfError

from app.core.errors import AppError

log = logging.getLogger("app.documents")

MIN_TEXT_CHARS = 20  # abaixo disso o documento é tratado como "sem texto" (ex.: PDF escaneado)


def clean_text(text: str) -> str:
    """Normaliza espaços e quebras sem mexer no conteúdo; remove caracteres de controle e o byte nulo."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = re.sub(r"[\x01-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)
    text = re.sub(r"[ \t ]+", " ", text)
    text = re.sub(r" ?\n ?", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_pdf_text(raw: bytes, max_pages: int) -> tuple[str, int]:
    """Texto de um PDF, página a página. Retorna (texto, número de páginas)."""
    if not raw.lstrip(b"\x00 \t\r\n")[:5] == b"%PDF-":  # confere o conteúdo real, não o nome nem o tipo declarado
        raise AppError(400, "Este arquivo não é um PDF válido.")
    try:
        reader = PdfReader(io.BytesIO(raw))
        if reader.is_encrypted:
            raise AppError(400, "Este PDF é protegido por senha. Remova a proteção e envie de novo.")
        pages = len(reader.pages)
        if pages > max_pages:
            raise AppError(413, f"O PDF tem {pages} páginas (máximo {max_pages}). Envie por partes.")
        parts = [(page.extract_text() or "") for page in reader.pages]
    except AppError:
        raise
    except (PyPdfError, ValueError, KeyError, TypeError, IndexError, RecursionError, OSError):
        log.warning("falha ao ler PDF", exc_info=True)
        raise AppError(400, "Não foi possível ler este PDF. Ele pode estar corrompido.") from None
    text = clean_text("\n\n".join(parts))
    if len(text) < MIN_TEXT_CHARS:
        raise AppError(
            422,
            "Não encontrei texto neste PDF (pode ser um documento escaneado). "
            "Envie as páginas como imagem e use \"Extrair texto\".",
        )
    return text, pages


# ---------- HTML ----------

_SKIP = {"script", "style", "noscript", "svg", "template", "iframe", "head", "nav", "footer", "aside", "form", "button"}
_BLOCK = {
    "p", "div", "section", "article", "main", "br", "li", "ul", "ol", "tr", "table", "blockquote", "pre",
    "h1", "h2", "h3", "h4", "h5", "h6", "dd", "dt", "figcaption",
}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title = ""
        self._in_title = False
        self._skip_depth = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "title":
            self._in_title = True
        if tag in _SKIP and tag != "head":
            self._skip_depth += 1
        elif tag in _BLOCK:
            self._parts.append("\n")
            if tag.startswith("h") and len(tag) == 2:
                self._parts.append("#" * int(tag[1]) + " ")
            elif tag == "li":
                self._parts.append("- ")

    def handle_endtag(self, tag: str) -> None:
        if tag == "title":
            self._in_title = False
        if tag in _SKIP and tag != "head":
            self._skip_depth = max(0, self._skip_depth - 1)
        elif tag in _BLOCK:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        elif self._skip_depth == 0:
            self._parts.append(data)

    def text(self) -> str:
        return clean_text("".join(self._parts))


def extract_html_text(html: str) -> tuple[str, str]:
    """Texto legível de uma página web e o título dela. Descarta scripts, menus e rodapés."""
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return parser.text(), clean_text(parser.title)


# ---------- links ----------

def text_from_link(url: str, settings, transport=None) -> tuple[str, str]:
    """Baixa um link público e devolve (texto, nome da fonte). Aceita páginas HTML, texto simples e PDF."""
    from app.services.web_fetch import TEXT_TYPES, fetch_public

    fetched = fetch_public(url, max_bytes=settings.max_link_bytes, timeout=settings.link_timeout_seconds, transport=transport)
    kind = fetched.content_type
    if kind == "application/pdf" or fetched.body[:5] == b"%PDF-":
        text, _ = extract_pdf_text(fetched.body, settings.max_pdf_pages)
        return text, fetched.url
    if kind and kind not in TEXT_TYPES:
        raise AppError(422, "Este link não é uma página de texto nem um PDF, então não consigo ler o conteúdo.")
    html = fetched.body.decode("utf-8", errors="replace")
    if kind == "text/plain" or kind == "text/markdown":
        text, title = clean_text(html), ""
    else:
        text, title = extract_html_text(html)
    if len(text) < MIN_TEXT_CHARS:
        raise AppError(
            422,
            "Não encontrei texto nesta página (ela pode depender de JavaScript ou de login). Cole o texto manualmente.",
        )
    return (f"# {title}\n\n{text}" if title and not text.startswith(title) else text), fetched.url
