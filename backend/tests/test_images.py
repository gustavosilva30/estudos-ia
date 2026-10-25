import io
import struct

import pytest
from PIL import Image

from app.core.errors import AppError
from app.services import images
from app.services.images import MAX_SIDE, process_upload


def make(fmt="PNG", size=(300, 200), mode="RGB", color=(250, 250, 250), **save):
    img = Image.new(mode, size, color)
    buffer = io.BytesIO()
    img.save(buffer, format=fmt, **save)
    return buffer.getvalue()


def open_result(result):
    return Image.open(io.BytesIO(result.data))


def test_png_pequeno_continua_png():
    out = process_upload(make("PNG"))
    assert out.mime_type == "image/png" and (out.width, out.height) == (300, 200)
    assert open_result(out).format == "PNG" and len(out.sha256) == 64


def test_jpeg_e_webp_viram_jpeg_recodificado():
    for fmt in ("JPEG", "WEBP"):
        out = process_upload(make(fmt))
        assert out.mime_type == "image/jpeg" and open_result(out).format == "JPEG", fmt


def test_reduz_imagens_grandes_mantendo_proporcao():
    out = process_upload(make("JPEG", size=(4000, 1000)))
    assert max(out.width, out.height) == MAX_SIDE and (out.width, out.height) == (2000, 500)


def test_remove_metadados_exif_e_gps():
    img = Image.new("RGB", (100, 100), "white")
    exif = Image.Exif()
    exif[0x010F] = "Fabricante Secreto"  # Make
    exif[0x8825] = {1: "S", 2: (23.0, 33.0, 0.0)}  # GPS
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", exif=exif)
    assert b"Fabricante Secreto" in buffer.getvalue()  # o original tinha mesmo os metadados

    out = process_upload(buffer.getvalue())
    assert b"Fabricante Secreto" not in out.data
    assert len(open_result(out).getexif()) == 0


def test_aplica_a_rotacao_exif_antes_de_remover():
    img = Image.new("RGB", (200, 100), "white")
    exif = Image.Exif()
    exif[0x0112] = 6  # Orientation: girar 90°
    buffer = io.BytesIO()
    img.save(buffer, format="JPEG", exif=exif)
    out = process_upload(buffer.getvalue())
    assert (out.width, out.height) == (100, 200)


def test_transparencia_vira_fundo_branco():
    out = process_upload(make("PNG", mode="RGBA", color=(0, 0, 0, 0)))
    assert open_result(out).convert("RGB").getpixel((5, 5)) == (255, 255, 255)


def test_gif_animado_usa_so_o_primeiro_quadro():
    first = Image.new("RGB", (50, 50), "red")
    second = Image.new("RGB", (50, 50), "blue")
    buffer = io.BytesIO()
    first.save(buffer, format="GIF", save_all=True, append_images=[second])
    with pytest.raises(AppError) as exc:  # GIF não está na lista de formatos aceitos
        process_upload(buffer.getvalue())
    assert exc.value.status_code == 415


@pytest.mark.parametrize(
    "raw",
    [
        b"",
        b"isto nao e uma imagem",
        b"<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>",
        b"%PDF-1.7 conteudo",
        b"GIF89a" + b"\x00" * 20,
    ],
)
def test_recusa_arquivos_que_nao_sao_imagens_aceitas(raw):
    with pytest.raises(AppError) as exc:
        process_upload(raw)
    assert exc.value.status_code in (400, 415)


def test_recusa_imagem_truncada():
    data = make("PNG", size=(400, 400))
    with pytest.raises(AppError) as exc:
        process_upload(data[: len(data) // 2])
    assert exc.value.status_code == 400


def test_carga_escondida_depois_da_imagem_e_descartada():
    data = make("PNG") + b"<?php system($_GET['x']); ?>"
    out = process_upload(data)
    assert b"<?php" not in out.data


def test_recusa_bomba_de_descompressao(monkeypatch):
    monkeypatch.setattr(images, "MAX_PIXELS", 10_000)
    with pytest.raises(AppError) as exc:
        process_upload(make("PNG", size=(200, 200)))
    assert exc.value.status_code == 413


def test_png_de_cabecalho_enorme_nao_estoura_a_memoria():
    # PNG válido no cabeçalho declarando 60000x60000 px (3,6 bi de pixels), sem dados de imagem.
    png = bytearray(make("PNG", size=(10, 10)))
    png[16:24] = struct.pack(">II", 60000, 60000)
    with pytest.raises(AppError) as exc:
        process_upload(bytes(png))
    assert exc.value.status_code in (400, 413)


def test_resultado_respeita_o_teto_de_tamanho_armazenado():
    import os

    noisy = Image.frombytes("RGB", (1800, 1800), os.urandom(1800 * 1800 * 3))
    buffer = io.BytesIO()
    noisy.save(buffer, format="PNG")
    out = process_upload(buffer.getvalue())
    assert len(out.data) <= images.MAX_STORED_BYTES * 1.05
    assert out.mime_type == "image/jpeg"
