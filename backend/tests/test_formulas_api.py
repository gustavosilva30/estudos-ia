"""Fórmulas do usuário pela API (com banco): favoritos/anotações, fórmulas próprias e vínculo com aulas."""

import uuid

import pytest
from conftest import build_app
from sqlalchemy import text
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


def custom_body(**over):
    body = {
        "title": "Energia potencial", "category": "fisica", "latex": "E = m g h", "description": "Energia armazenada.",
        "variables": [{"id": "m", "name": "massa", "unit": "kg"}, {"id": "g", "name": "gravidade", "unit": "m/s²"}, {"id": "h", "name": "altura", "unit": "m"}],
        "expression": "m*g*h", "result_name": "Ep", "result_label": "energia", "result_unit": "J",
    }
    body.update(over)
    return body


def new_custom(user, **over):
    r = user.post("/api/v1/formulas/custom", custom_body(**over))
    assert r.status_code == 201, r.text
    return r.json()


def put_mark(user, key, **body):
    return user.c.put(f"/api/v1/formulas/marks/{key}", json=body, headers=user.h)


# ---------- favoritos e anotações ----------

def test_favoritar_anotar_e_remover_a_marca(ana):
    r = put_mark(ana, "b:pitagoras", is_favorite=True)
    assert r.status_code == 200 and r.json()["is_favorite"] is True and r.json()["note"] is None
    r = put_mark(ana, "b:pitagoras", note="  Só vale em triângulo retângulo  ")
    assert r.json()["is_favorite"] is True and r.json()["note"] == "Só vale em triângulo retângulo"  # mantém o favorito
    assert [m["formula_key"] for m in ana.get("/api/v1/formulas/marks").json()] == ["b:pitagoras"]
    put_mark(ana, "b:pitagoras", is_favorite=False)
    assert ana.get("/api/v1/formulas/marks").json()[0]["note"] == "Só vale em triângulo retângulo"  # ainda tem anotação
    r = put_mark(ana, "b:pitagoras", note="   ")  # sem favorito e sem anotação: some
    assert r.status_code == 200 and r.json()["is_favorite"] is False and r.json()["note"] is None
    assert ana.get("/api/v1/formulas/marks").json() == []


def test_marcas_sao_privadas(ana, bia):
    put_mark(ana, "b:ohm", is_favorite=True, note="minha")
    assert bia.get("/api/v1/formulas/marks").json() == []
    put_mark(bia, "b:ohm", is_favorite=True)
    assert [m["note"] for m in ana.get("/api/v1/formulas/marks").json()] == ["minha"]


@pytest.mark.parametrize("key", ["pitagoras", "b:", "b:MAIÚSCULA", "x:abc", "c:não-é-uuid", "b:" + "a" * 61, "b:a b"])
def test_chave_invalida_e_recusada(ana, key):
    assert put_mark(ana, key, is_favorite=True).status_code in (404, 422)


def test_marca_exige_login_e_csrf(ana, app):
    from fastapi.testclient import TestClient
    assert TestClient(app).put("/api/v1/formulas/marks/b:ohm", json={"is_favorite": True}).status_code in (401, 403)
    assert ana.c.put("/api/v1/formulas/marks/b:ohm", json={"is_favorite": True}).status_code == 403  # sem CSRF


def test_anotacao_longa_demais(ana):
    assert put_mark(ana, "b:ohm", note="x" * 5001).status_code == 422


# ---------- fórmulas próprias ----------

def test_criar_listar_editar_e_excluir_formula_propria(ana):
    f = new_custom(ana)
    assert f["title"] == "Energia potencial" and [v["id"] for v in f["variables"]] == ["m", "g", "h"]
    assert [x["id"] for x in ana.get("/api/v1/formulas/custom").json()] == [f["id"]]
    r = ana.c.put(f"/api/v1/formulas/custom/{f['id']}", json=custom_body(title="Ep gravitacional", latex=""), headers=ana.h)
    assert r.status_code == 200 and r.json()["title"] == "Ep gravitacional" and r.json()["latex"] is None
    assert ana.delete(f"/api/v1/formulas/custom/{f['id']}").status_code == 204
    assert ana.get("/api/v1/formulas/custom").json() == []


@pytest.mark.parametrize("over", [
    {"title": "   "}, {"title": "x" * 121}, {"category": "historia"}, {"expression": ""}, {"expression": "x" * 301},
    {"result_name": "1abc"}, {"result_name": "pi"}, {"result_name": "m"},  # repete variável
    {"variables": [{"id": "m", "name": "a"}, {"id": "m", "name": "b"}]},  # repetida
    {"variables": [{"id": "e", "name": "reservada"}]}, {"variables": [{"id": "a b", "name": "x"}]},
    {"variables": [{"id": f"v{i}", "name": "n"} for i in range(13)]},
    {"variables": [{"id": "v", "name": ""}]}, {"latex": "x" * 501}, {"description": "x" * 2001},
])
def test_formula_propria_invalida(ana, over):
    assert ana.post("/api/v1/formulas/custom", custom_body(**over)).status_code == 422


def test_formulas_proprias_sao_privadas(ana, bia):
    f = new_custom(ana)
    assert bia.get("/api/v1/formulas/custom").json() == []
    assert bia.c.put(f"/api/v1/formulas/custom/{f['id']}", json=custom_body(title="roubada"), headers=bia.h).status_code == 404
    assert bia.delete(f"/api/v1/formulas/custom/{f['id']}").status_code == 404
    assert put_mark(bia, f"c:{f['id']}", is_favorite=True).status_code == 404  # nem marcar a fórmula dela
    assert ana.get("/api/v1/formulas/custom").json()[0]["title"] == "Energia potencial"


def test_limite_de_formulas_proprias(ana, db, monkeypatch):
    from app.services import formulas as svc
    monkeypatch.setattr(svc, "MAX_CUSTOM_FORMULAS", 2)
    new_custom(ana)
    new_custom(ana, title="B")
    assert ana.post("/api/v1/formulas/custom", custom_body(title="C")).status_code == 409


def test_excluir_formula_propria_remove_marcas_e_vinculos(ana, db):
    f = new_custom(ana)
    key = f"c:{f['id']}"
    aula = ana.lesson(ana.subject()["id"])
    put_mark(ana, key, is_favorite=True)
    assert ana.post(f"/api/v1/lessons/{aula['id']}/formulas", {"formula_key": key}).status_code == 201
    ana.delete(f"/api/v1/formulas/custom/{f['id']}")
    assert ana.get("/api/v1/formulas/marks").json() == []
    assert ana.get(f"/api/v1/lessons/{aula['id']}/formulas").json() == []
    assert db.scalar(text("SELECT count(*) FROM lesson_formulas")) == 0


# ---------- vínculo com aulas ----------

def test_vincular_listar_e_desvincular(ana):
    s = ana.subject("Física")
    aula = ana.lesson(s["id"], "Cinemática")
    url = f"/api/v1/lessons/{aula['id']}/formulas"
    assert ana.post(url, {"formula_key": "b:mru"}).status_code == 201
    assert ana.post(url, {"formula_key": "b:mru"}).status_code == 201  # repetir não duplica
    assert ana.post(url, {"formula_key": "b:torricelli"}).status_code == 201
    assert [x["formula_key"] for x in ana.get(url).json()] == ["b:mru", "b:torricelli"]
    onde = ana.get("/api/v1/formulas/b:mru/lessons").json()
    assert onde == [{"lesson_id": aula["id"], "lesson_title": "Cinemática", "subject_name": "Física"}]
    assert ana.delete(f"{url}/b:mru").status_code == 204
    assert ana.delete(f"{url}/b:mru").status_code == 404
    assert [x["formula_key"] for x in ana.get(url).json()] == ["b:torricelli"]


def test_vinculo_so_na_propria_aula(ana, bia):
    aula = ana.lesson(ana.subject()["id"])
    url = f"/api/v1/lessons/{aula['id']}/formulas"
    assert bia.post(url, {"formula_key": "b:mru"}).status_code == 404
    assert bia.get(url).status_code == 404
    assert bia.delete(f"{url}/b:mru").status_code == 404
    assert ana.post(url, {"formula_key": "b:mru"}).status_code == 201
    assert bia.get("/api/v1/formulas/b:mru/lessons").json() == []  # a aula da Ana não aparece para a Bia
    assert ana.post(url, {"formula_key": "invalida"}).status_code == 422
    assert ana.post(f"/api/v1/lessons/{uuid.uuid4()}/formulas", {"formula_key": "b:mru"}).status_code == 404


def test_excluir_a_aula_remove_os_vinculos(ana, db):
    aula = ana.lesson(ana.subject()["id"])
    ana.post(f"/api/v1/lessons/{aula['id']}/formulas", {"formula_key": "b:mru"})
    assert ana.delete(f"/api/v1/lessons/{aula['id']}").status_code == 204
    assert db.scalar(text("SELECT count(*) FROM lesson_formulas")) == 0


def test_limite_de_vinculos_por_aula(ana, monkeypatch):
    from app.services import formulas as svc
    monkeypatch.setattr(svc, "MAX_LINKS_PER_LESSON", 2)
    aula = ana.lesson(ana.subject()["id"])
    url = f"/api/v1/lessons/{aula['id']}/formulas"
    assert [ana.post(url, {"formula_key": k}).status_code for k in ("b:a", "b:b", "b:c")] == [201, 201, 409]


def test_texto_da_aula_pode_nascer_de_uma_formula(ana):
    aula = ana.lesson(ana.subject()["id"])
    r = ana.post(f"/api/v1/lessons/{aula['id']}/materials", {"content": "Teorema de Pitágoras: a² + b² = c²", "origin": "formula"})
    assert r.status_code == 201 and r.json()["origin"] == "formula"
    g = ana.post("/api/v1/ai/generate", {"material_id": r.json()["id"], "operation": "resumo_rapido"})
    assert g.status_code == 200, g.text  # a IA estuda a fórmula como qualquer texto da aula
