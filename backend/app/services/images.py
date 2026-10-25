"""Validação e preparo de imagens enviadas pelo usuário.

Nunca confiamos no nome do arquivo nem no Content-Type informado: o conteúdo é aberto e verificado com a
Pillow. A imagem é SEMPRE recodificada (descarta metadados EXIF/GPS, camadas extras e qualquer carga
escondida no arquivo original), orientada corretamente e reduzida. Só PNG, JPEG e WebP são aceitos
(SVG e GIF animado ficam de fora de propósito).
"""

import hashlib
import io
from dataclasses import dataclass

from PIL import Image, ImageFile, ImageOps, UnidentifiedImageError

from app.core.errors import AppError

# Sem isto, salvar JPEG/PNG com optimize=True falha ("Suspension not allowed here") em imagens detalhadas.
ImageFile.MAXBLOCK = max(ImageFile.MAXBLOCK, 16 * 1024 * 1024)

ALLOWED_FORMATS = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
MAX_SIDE = 2000  # pixels no maior lado: legível para texto e fórmulas, barato em tokens
MAX_PIXELS = 40_000_000  # limite contra "bombas de descompressão"
MAX_STORED_BYTES = 1_500_000
PNG_PREFERRED_BYTES = 900_000  # capturas de tela ficam melhores em PNG, se não ficar pesado


@dataclass(frozen=True)
class ProcessedImage:
    data: bytes
    mime_type: str
    width: int
    height: int
    sha256: str


def _encode(img: Image.Image, fmt: str, quality: int) -> bytes:
    buffer = io.BytesIO()
    if fmt == "PNG":
        img.save(buffer, format="PNG", optimize=True)
    else:
        img.save(buffer, format="JPEG", quality=quality, subsampling=0, optimize=True)  # 4:4:4 preserva traços finos
    return buffer.getvalue()


def process_upload(raw: bytes) -> ProcessedImage:
    if not raw:
        raise AppError(400, "O arquivo está vazio.")
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS  # acima de 2x isso a Pillow já recusa
    try:
        probe = Image.open(io.BytesIO(raw))
        fmt = probe.format
        probe.verify()  # detecta arquivo truncado/corrompido
        img = Image.open(io.BytesIO(raw))  # verify() invalida o objeto: reabre
        width, height = img.size
        if fmt not in ALLOWED_FORMATS:
            raise AppError(415, "Formato de imagem não suportado. Use PNG, JPEG ou WebP.")
        if width * height > MAX_PIXELS:
            raise AppError(413, "A imagem tem resolução alta demais. Reduza o tamanho e tente de novo.")
        img.seek(0)  # imagens animadas: usa só o primeiro quadro
        img.load()
    except AppError:
        raise
    except Image.DecompressionBombError:
        raise AppError(413, "A imagem tem resolução alta demais. Reduza o tamanho e tente de novo.") from None
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, EOFError):
        raise AppError(400, "Não foi possível ler a imagem. O arquivo pode estar corrompido ou não ser uma imagem.") from None

    img = ImageOps.exif_transpose(img)  # aplica a rotação do celular antes de apagar os metadados
    if img.mode in ("RGBA", "LA", "P"):  # transparência vira fundo branco (melhor para leitura de texto)
        rgba = img.convert("RGBA")
        background = Image.new("RGB", rgba.size, (255, 255, 255))
        background.paste(rgba, mask=rgba.getchannel("A"))
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    if max(img.size) > MAX_SIDE:
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)

    data = b""
    mime = "image/jpeg"
    if fmt == "PNG":
        data = _encode(img, "PNG", 0)
        mime = "image/png"
        if len(data) > PNG_PREFERRED_BYTES:
            data = b""
    if not data:
        mime = "image/jpeg"
        quality = 90
        data = _encode(img, "JPEG", quality)
        while len(data) > MAX_STORED_BYTES and quality > 55:
            quality -= 10
            data = _encode(img, "JPEG", quality)
        while len(data) > MAX_STORED_BYTES and max(img.size) > 800:  # último recurso: reduz mais
            img = img.resize((int(img.width * 0.85), int(img.height * 0.85)), Image.Resampling.LANCZOS)
            data = _encode(img, "JPEG", quality)

    return ProcessedImage(
        data=data, mime_type=mime, width=img.width, height=img.height, sha256=hashlib.sha256(data).hexdigest()
    )
