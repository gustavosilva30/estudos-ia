"""Leitura de PDF e de links: extração de texto e proteção contra acesso a redes internas (sem rede real)."""

import socket

import httpcore
import httpx
import pytest
from conftest import build_app
from fastapi.testclient import TestClient
from test_library import User

from app.core.errors import AppError
from app.services import documents, web_fetch


def make_pdf(*pages: str) -> bytes:
    """PDF mínimo (uma linha de texto por página) com tabela xref correta."""
    objs: list[bytes] = []
    kids = " ".join(f"{3 + 2 * i} 0 R" for i in range(len(pages)))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    for i, text in enumerate(pages):
        content = f"BT /F1 12 Tf 50 700 Td ({text}) Tj ET".encode()
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {4 + 2 * i} 0 R "
            f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>".encode()
        )
        objs.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    out = b"%PDF-1.4\n"
    offsets = []
    for n, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF" % (len(objs) + 1, xref)
    return out


# ---------- PDF ----------

def test_pdf_extrai_texto_de_todas_as_paginas():
    text, pages = documents.extract_pdf_text(make_pdf("Fotossintese converte luz em energia", "Segunda pagina com mais texto"), 10)
    assert pages == 2 and "Fotossintese converte luz em energia" in text and "Segunda pagina" in text


def test_pdf_recusa_arquivo_que_nao_e_pdf():
    with pytest.raises(AppError) as exc:
        documents.extract_pdf_text(b"MZ\x90\x00 isto e um executavel", 10)
    assert exc.value.status_code == 400


def test_pdf_corrompido_vira_erro_amigavel():
    with pytest.raises(AppError) as exc:
        documents.extract_pdf_text(b"%PDF-1.4\n lixo sem estrutura", 10)
    assert exc.value.status_code in (400, 422)


def test_pdf_com_paginas_demais_e_recusado():
    with pytest.raises(AppError) as exc:
        documents.extract_pdf_text(make_pdf(*["Pagina com texto suficiente"] * 4), 3)
    assert exc.value.status_code == 413


def test_pdf_sem_texto_orienta_a_usar_imagem():
    with pytest.raises(AppError) as exc:
        documents.extract_pdf_text(make_pdf("  "), 10)
    assert exc.value.status_code == 422 and "imagem" in str(exc.value)


# ---------- HTML ----------

def test_html_extrai_texto_e_descarta_scripts_menus_e_rodape():
    html = """<html><head><title>Aula de Biologia</title><style>p{color:red}</style></head><body>
    <nav>Menu inicial</nav><script>alert('x')</script>
    <h1>Células</h1><p>A célula é a unidade básica da vida.</p><ul><li>Núcleo</li><li>Membrana</li></ul>
    <footer>Copyright</footer></body></html>"""
    text, title = documents.extract_html_text(html)
    assert title == "Aula de Biologia"
    assert "# Células" in text and "unidade básica da vida" in text and "- Núcleo" in text
    assert "alert" not in text and "Menu inicial" not in text and "Copyright" not in text and "color:red" not in text


# ---------- proteção contra SSRF ----------

@pytest.mark.parametrize("url", [
    "ftp://exemplo.com/a", "file:///etc/passwd", "javascript:alert(1)", "http://", "exemplo.com/sem-esquema",
    "http://user:senha@exemplo.com/", "http://exemplo.com:22/", "http://exemplo.com:5432/", "https://exemplo.com:8443/",
    "http://127.0.0.1/", "http://10.0.0.5/", "http://192.168.1.1/", "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/", "http://[::ffff:127.0.0.1]/", "http://0.0.0.0/", "http://172.16.0.1:80/",
])
def test_urls_perigosas_sao_recusadas(url):
    with pytest.raises(AppError) as exc:
        web_fetch.validate_url(url)
    assert exc.value.status_code == 400


def test_url_publica_e_aceita_e_remove_fragmento():
    assert str(web_fetch.validate_url("https://exemplo.com/aula?x=1#topo")) == "https://exemplo.com/aula?x=1"


def fake_dns(monkeypatch, mapping):
    def getaddrinfo(host, port, **_):
        if host not in mapping:
            raise socket.gaierror
        return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (ip, port)) for ip in mapping[host]]
    monkeypatch.setattr(socket, "getaddrinfo", getaddrinfo)


def test_nome_que_resolve_para_ip_interno_e_recusado(monkeypatch):
    fake_dns(monkeypatch, {"interno.exemplo.com": ["10.0.0.7"], "misto.exemplo.com": ["93.184.216.34", "127.0.0.1"]})
    for host in ("interno.exemplo.com", "misto.exemplo.com"):  # um IP interno entre os retornados já basta para recusar
        with pytest.raises(AppError):
            web_fetch.resolve_public(host, 443)
    with pytest.raises(AppError):
        web_fetch.resolve_public("nao-existe.exemplo.com", 443)


def test_conexao_so_vai_para_ip_publico_ja_conferido(monkeypatch):
    fake_dns(monkeypatch, {"publico.exemplo.com": ["93.184.216.34"], "rebind.exemplo.com": ["192.168.0.10"]})
    conectados = []
    monkeypatch.setattr(httpcore.SyncBackend, "connect_tcp", lambda self, host, port, **kw: conectados.append(host) or "stream")
    backend = web_fetch._PublicOnlyBackend()
    assert backend.connect_tcp("publico.exemplo.com", 443) == "stream" and conectados == ["93.184.216.34"]
    with pytest.raises(AppError):
        backend.connect_tcp("rebind.exemplo.com", 443)
    assert conectados == ["93.184.216.34"]  # nenhuma tentativa de conexão ao IP interno


def test_transporte_real_usa_o_backend_restrito():
    assert isinstance(web_fetch.build_transport()._pool._network_backend, web_fetch._PublicOnlyBackend)


def fetch(handler, url="https://exemplo.com/aula", **kw):
    return web_fetch.fetch_public(url, max_bytes=kw.pop("max_bytes", 1_000_000), timeout=5, transport=httpx.MockTransport(handler), **kw)


def test_redirecionamento_para_rede_interna_e_recusado():
    def handler(request):
        return httpx.Response(302, headers={"location": "http://169.254.169.254/latest/meta-data/"})
    with pytest.raises(AppError) as exc:
        fetch(handler)
    assert exc.value.status_code == 400


def test_redirecionamento_publico_e_seguido_e_loop_e_cortado():
    def handler(request):
        if request.url.path == "/aula":
            return httpx.Response(301, headers={"location": "/nova"})
        return httpx.Response(200, headers={"content-type": "text/html"}, content=b"<p>Conteudo</p>")
    assert fetch(handler).url == "https://exemplo.com/nova"
    with pytest.raises(AppError) as exc:
        fetch(lambda r: httpx.Response(302, headers={"location": "/outra"}))
    assert exc.value.status_code == 502


def test_conteudo_grande_demais_e_recusado_pelo_cabecalho_e_pelo_corpo():
    with pytest.raises(AppError) as exc:
        fetch(lambda r: httpx.Response(200, headers={"content-length": "5000000"}, content=b"x"), max_bytes=1000)
    assert exc.value.status_code == 413
    with pytest.raises(AppError) as exc:  # sem content-length: o limite vale durante a leitura
        fetch(lambda r: httpx.Response(200, content=b"x" * 5000), max_bytes=1000)
    assert exc.value.status_code == 413


@pytest.mark.parametrize(("status", "expected"), [(404, 422), (403, 422), (500, 502)])
def test_erros_http_viram_mensagens_claras(status, expected):
    with pytest.raises(AppError) as exc:
        fetch(lambda r: httpx.Response(status))
    assert exc.value.status_code == expected


def test_tempo_esgotado_vira_504():
    def handler(request):
        raise httpx.ReadTimeout("lento")
    with pytest.raises(AppError) as exc:
        fetch(handler)
    assert exc.value.status_code == 504


# ---------- API ----------

PAGINA = (
    b"<html><head><title>Fotossintese</title></head><body><h1>Fotossintese</h1>"
    b"<p>A fotossintese converte luz solar em energia quimica nas plantas.</p></body></html>"
)


@pytest.fixture
def app(db):
    return build_app(db, ai_retry_backoff_seconds=0)


@pytest.fixture
def ana(app):
    return User(app, "ana@example.com")


@pytest.fixture
def bia(app):
    return User(app, "bia@example.com")


def aula(user):
    return user.lesson(user.subject("Biologia")["id"], "Plantas")


def enviar_pdf(user, lesson, data, name="aula.pdf", mime="application/pdf"):
    return user.c.post(f"/api/v1/lessons/{lesson['id']}/materials/from-file", files={"file": (name, data, mime)}, headers=user.h)


def usar_site(monkeypatch, handler):
    monkeypatch.setattr(web_fetch, "build_transport", lambda: httpx.MockTransport(handler))


def link(user, lesson, url):
    return user.c.post(f"/api/v1/lessons/{lesson['id']}/materials/from-link", json={"url": url}, headers=user.h)


def test_pdf_vira_texto_da_aula_com_origem_e_nome(ana):
    a = aula(ana)
    r = enviar_pdf(ana, a, make_pdf("Mitocondrias produzem energia para a celula"), name="C:\\Users\\ana\\biologia.pdf")
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["origin"] == "pdf" and m["source_name"] == "biologia.pdf" and "Mitocondrias" in m["content"]
    detalhe = ana.get(f"/api/v1/lessons/{a['id']}").json()
    assert [x["id"] for x in detalhe["materials"]] == [m["id"]]


def test_pdf_falso_com_nome_e_tipo_de_pdf_e_recusado(ana):
    a = aula(ana)
    r = enviar_pdf(ana, a, b"<html>nao sou pdf</html>")
    assert r.status_code == 400 and ana.get(f"/api/v1/lessons/{a['id']}").json()["materials"] == []


def test_pdf_grande_demais_e_recusado(db):
    app = build_app(db, max_document_bytes=1000)
    ana = User(app, "ana@example.com")
    r = enviar_pdf(ana, aula(ana), make_pdf("texto " * 500))
    assert r.status_code == 413


def test_texto_extraido_acima_do_limite_e_recusado(ana, monkeypatch):
    monkeypatch.setattr(documents, "extract_pdf_text", lambda raw, max_pages: ("x" * 100_001, 1))
    r = enviar_pdf(ana, aula(ana), make_pdf("qualquer"))
    assert r.status_code == 413 and "100.001" in r.json()["detail"]


def test_link_vira_texto_da_aula(ana, monkeypatch):
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "text/html; charset=utf-8"}, content=PAGINA))
    r = link(ana, aula(ana), "https://exemplo.com/fotossintese#secao")
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["origin"] == "link" and m["source_name"] == "https://exemplo.com/fotossintese"
    assert "converte luz solar" in m["content"]


def test_link_para_pdf_e_lido(ana, monkeypatch):
    pdf = make_pdf("Conteudo de um PDF publicado na internet")
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "application/pdf"}, content=pdf))
    r = link(ana, aula(ana), "https://exemplo.com/apostila.pdf")
    assert r.status_code == 201 and "PDF publicado" in r.json()["content"]


def test_link_para_tipo_nao_suportado_e_pagina_sem_texto(ana, monkeypatch):
    a = aula(ana)
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "application/zip"}, content=b"PK"))
    assert link(ana, a, "https://exemplo.com/a.zip").status_code == 422
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "text/html"}, content=b"<html><script>app()</script></html>"))
    r = link(ana, a, "https://exemplo.com/spa")
    assert r.status_code == 422 and "JavaScript" in r.json()["detail"]


def test_link_interno_e_recusado_sem_abrir_conexao(ana, monkeypatch):
    chamado = []
    usar_site(monkeypatch, lambda r: chamado.append(r) or httpx.Response(200))
    a = aula(ana)
    for url in ("http://localhost:8000/api/v1/auth/me", "http://127.0.0.1/", "http://169.254.169.254/", "file:///etc/passwd"):
        assert link(ana, a, url).status_code == 400
    assert chamado == []


def test_outro_usuario_nao_importa_para_aula_alheia(ana, bia, monkeypatch):
    chamado = []
    usar_site(monkeypatch, lambda r: chamado.append(r) or httpx.Response(200, headers={"content-type": "text/html"}, content=PAGINA))
    a = aula(ana)
    assert enviar_pdf(bia, a, make_pdf("Texto do invasor aqui")).status_code == 404
    assert link(bia, a, "https://exemplo.com/x").status_code == 404
    assert chamado == [] and ana.get(f"/api/v1/lessons/{a['id']}").json()["materials"] == []


def test_importacao_exige_login_e_csrf(ana, app):
    a = aula(ana)
    url = f"/api/v1/lessons/{a['id']}/materials/from-link"
    body = {"url": "https://exemplo.com/x"}
    assert TestClient(app).post(url, json=body).status_code in (401, 403)
    assert ana.c.post(url, json=body).status_code == 403  # logada, mas sem o cabeçalho CSRF


def test_limite_de_importacoes_por_usuario(db, monkeypatch):
    app = build_app(db, rate_limit_import_user=2)
    ana = User(app, "ana@example.com")
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "text/html"}, content=PAGINA))
    a = aula(ana)
    assert [link(ana, a, f"https://exemplo.com/{i}").status_code for i in range(3)] == [201, 201, 429]


def test_texto_importado_pode_ser_editado_e_usado_pela_ia(ana, monkeypatch):
    usar_site(monkeypatch, lambda r: httpx.Response(200, headers={"content-type": "text/html"}, content=PAGINA))
    m = link(ana, aula(ana), "https://exemplo.com/fotossintese").json()
    r = ana.c.patch(f"/api/v1/materials/{m['id']}", json={"content": "Texto revisado pela pessoa."}, headers=ana.h)
    assert r.status_code == 200 and r.json()["origin"] == "link"
    g = ana.c.post("/api/v1/ai/generate", json={"material_id": m["id"], "operation": "resumo_rapido"}, headers=ana.h)
    assert g.status_code == 200, g.text
