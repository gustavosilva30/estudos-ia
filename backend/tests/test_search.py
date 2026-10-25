import pytest
from conftest import build_app
from fastapi.testclient import TestClient
from test_library import User


@pytest.fixture
def app(db):
    return build_app(db, ai_retry_backoff_seconds=0)


@pytest.fixture
def ana(app):
    return User(app, "ana@example.com")


@pytest.fixture
def bia(app):
    return User(app, "bia@example.com")


def busca(user, q):
    return user.get("/api/v1/search", params={"q": q})


def popular(user):
    bio = user.subject("Biologia")
    aula = user.lesson(bio["id"], "Fotossíntese das plantas", content="A clorofila absorve a luz nos cloroplastos.")
    user.lesson(bio["id"], "Outra aula", content="Nada a ver.")
    ger = user.post("/api/v1/ai/generate", {"material_id": aula["materials"][0]["id"], "operation": "resumo_completo"}).json()
    user.post(f"/api/v1/ai/generations/{ger['id']}/save", {"title": "Resumo de cloroplastos"})
    return bio, aula


def test_pesquisa_encontra_materias_aulas_e_resumos(ana):
    popular(ana)
    r = busca(ana, "cloroplastos").json()
    assert r["query"] == "cloroplastos"
    assert [s["title"] for s in r["summaries"]] == ["Resumo de cloroplastos"]
    assert [x["title"] for x in r["lessons"]] == ["Fotossíntese das plantas"]  # achou pelo texto original
    assert busca(ana, "biolog").json()["subjects"][0]["name"] == "Biologia"
    assert busca(ana, "planta").json()["lessons_total"] == 1


def test_trecho_marca_os_termos_como_texto(ana):
    popular(ana)
    snippet = busca(ana, "clorofila").json()["summaries"][0]["snippet"]
    assert "<<" in snippet and ">>" in snippet


def test_pesquisa_valida_a_consulta_e_trata_curingas_como_texto(ana):
    assert busca(ana, "a").status_code == 422
    assert ana.get("/api/v1/search").status_code == 422
    assert busca(ana, "x" * 201).status_code == 422
    bio = ana.subject("100% Prática")
    ana.lesson(bio["id"], "Aula qualquer")
    r = busca(ana, "100%").json()
    assert [s["name"] for s in r["subjects"]] == ["100% Prática"]
    assert busca(ana, "__").json()["subjects"] == []


def test_pesquisa_limita_resultados_mas_informa_o_total(ana):
    s = ana.subject()
    for i in range(10):
        ana.lesson(s["id"], f"Termodinâmica parte {i}")
    r = busca(ana, "termodinâmica").json()
    assert len(r["lessons"]) == 8 and r["lessons_total"] == 10


def test_pesquisa_nao_vaza_dados_de_outro_usuario(ana, bia):
    popular(bia)
    for termo in ("cloroplastos", "Biologia", "clorofila", "Fotossíntese"):
        r = busca(ana, termo).json()
        assert r["subjects"] == [] and r["lessons"] == [] and r["summaries"] == []
        assert r["lessons_total"] == 0 and r["summaries_total"] == 0
    assert busca(bia, "cloroplastos").json()["lessons_total"] == 1


def test_pesquisa_exige_login(app):
    assert TestClient(app).get("/api/v1/search", params={"q": "teste"}).status_code == 401
