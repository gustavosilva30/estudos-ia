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


def test_dashboard_vazio(ana):
    d = ana.get("/api/v1/dashboard").json()
    assert d["counts"] == {"subjects": 0, "lessons": 0, "materials": 0, "summaries": 0, "favorites": 0}
    assert d["progress"]["percent_with_summary"] == 0
    assert d["recent_lessons"] == [] and d["recent_summaries"] == []
    assert d["reviews"] == {"available": False, "pending": None}  # revisão ainda não existe: sem número inventado


def test_dashboard_reflete_dados_reais(ana):
    bio, hist = ana.subject("Biologia"), ana.subject("História")
    a1 = ana.lesson(bio["id"], "Célula", content="A célula é a unidade da vida.")
    ana.lesson(bio["id"], "DNA", content="O DNA guarda a informação genética.")
    ana.lesson(hist["id"], "Roma")  # sem texto
    ana.patch(f"/api/v1/lessons/{a1['id']}", {"is_favorite": True})
    gen = ana.post("/api/v1/ai/generate", {"material_id": a1["materials"][0]["id"], "operation": "resumo_completo"}).json()
    s = ana.post(f"/api/v1/ai/generations/{gen['id']}/save", {}).json()
    ana.patch(f"/api/v1/summaries/{s['id']}", {"is_favorite": True})
    ana.patch(f"/api/v1/subjects/{hist['id']}", {"is_archived": True})

    d = ana.get("/api/v1/dashboard").json()
    assert d["counts"] == {"subjects": 1, "lessons": 3, "materials": 2, "summaries": 1, "favorites": 2}
    assert d["progress"] == {
        "lessons_total": 3, "lessons_with_material": 2, "lessons_with_summary": 1, "percent_with_summary": 33,
    }
    assert d["recent_lessons"][0]["title"] == "Célula"  # mexido por último (resumo/favorito)
    assert len(d["recent_lessons"]) == 3
    assert d["recent_summaries"][0]["lesson_title"] == "Célula" and d["recent_summaries"][0]["is_favorite"] is True
    assert d["ai_usage"]["used_today"] == 1


def test_dashboard_limita_recentes_a_cinco(ana):
    s = ana.subject()
    for i in range(7):
        ana.lesson(s["id"], f"Aula {i}")
    assert len(ana.get("/api/v1/dashboard").json()["recent_lessons"]) == 5


def test_dashboard_nao_mistura_usuarios(ana, bia):
    bs = bia.subject("Física")
    bl = bia.lesson(bs["id"], "Aula da Bia", content="texto da bia")
    gen = bia.post("/api/v1/ai/generate", {"material_id": bl["materials"][0]["id"], "operation": "resumo_rapido"}).json()
    bia.post(f"/api/v1/ai/generations/{gen['id']}/save", {})
    d = ana.get("/api/v1/dashboard").json()
    assert d["counts"]["lessons"] == 0 and d["counts"]["summaries"] == 0 and d["recent_lessons"] == []
    assert d["ai_usage"]["used_today"] == 0
    assert bia.get("/api/v1/dashboard").json()["counts"]["lessons"] == 1


def test_dashboard_exige_login(app):
    assert TestClient(app).get("/api/v1/dashboard").status_code == 401
