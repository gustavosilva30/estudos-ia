import uuid

import pytest
from conftest import csrf, register
from fastapi.testclient import TestClient
from sqlalchemy import text


class User:
    """Cliente autenticado (cookie + CSRF) para os testes."""

    def __init__(self, app, email):
        self.c = TestClient(app)
        self.h = csrf(register(self.c, email))

    def get(self, url, **kw):
        return self.c.get(url, **kw)

    def post(self, url, json=None):
        return self.c.post(url, json=json, headers=self.h)

    def patch(self, url, json=None):
        return self.c.patch(url, json=json, headers=self.h)

    def delete(self, url):
        return self.c.delete(url, headers=self.h)

    # atalhos que exigem sucesso
    def subject(self, name="Biologia", **extra):
        r = self.post("/api/v1/subjects", {"name": name, **extra})
        assert r.status_code == 201, r.text
        return r.json()

    def folder(self, subject_id, name="Pasta", parent_id=None):
        r = self.post("/api/v1/folders", {"subject_id": subject_id, "name": name, "parent_id": parent_id})
        assert r.status_code == 201, r.text
        return r.json()

    def lesson(self, subject_id, title="Aula 1", **extra):
        r = self.post("/api/v1/lessons", {"subject_id": subject_id, "title": title, **extra})
        assert r.status_code == 201, r.text
        return r.json()


@pytest.fixture
def ana(app):
    return User(app, "ana@example.com")


@pytest.fixture
def bia(app):
    return User(app, "bia@example.com")


# ---------- matérias ----------

def test_materias_crud_e_contagem(ana):
    s = ana.subject("Biologia", color="#22aa55")
    ana.lesson(s["id"], "Célula")
    ana.lesson(s["id"], "DNA")
    lista = ana.get("/api/v1/subjects").json()
    assert lista["total"] == 1 and lista["items"][0]["lesson_count"] == 2

    r = ana.patch(f"/api/v1/subjects/{s['id']}", {"name": "Biologia Geral", "is_archived": True})
    assert r.status_code == 200 and r.json()["name"] == "Biologia Geral"
    assert ana.get("/api/v1/subjects").json()["total"] == 0  # arquivada some da lista padrão
    assert ana.get("/api/v1/subjects?include_archived=true").json()["total"] == 1


def test_materia_duplicada_e_validacao(ana):
    ana.subject("Química")
    assert ana.post("/api/v1/subjects", {"name": "Química"}).status_code == 409
    assert ana.post("/api/v1/subjects", {"name": "   "}).status_code == 422
    assert ana.post("/api/v1/subjects", {"name": "X", "color": "vermelho"}).status_code == 422


def test_excluir_materia_apaga_conteudo(ana, db):
    s = ana.subject()
    f = ana.folder(s["id"])
    aula = ana.lesson(s["id"], folder_id=f["id"], content="texto original")
    ana.post(f"/api/v1/lessons/{aula['id']}/notes", {"content": "nota"})
    assert ana.delete(f"/api/v1/subjects/{s['id']}").status_code == 204
    for t in ("folders", "lessons", "source_materials", "notes"):
        assert db.scalar(text(f"SELECT count(*) FROM {t}")) == 0


# ---------- pastas ----------

def test_pastas_hierarquia_e_regras(ana):
    s1, s2 = ana.subject("A"), ana.subject("B")
    raiz = ana.folder(s1["id"], "Raiz")
    filha = ana.folder(s1["id"], "Filha", raiz["id"])
    neta = ana.folder(s1["id"], "Neta", filha["id"])
    # pai de outra matéria
    assert ana.post("/api/v1/folders", {"subject_id": s2["id"], "name": "x", "parent_id": raiz["id"]}).status_code == 400
    # ciclos
    assert ana.patch(f"/api/v1/folders/{raiz['id']}", {"parent_id": neta["id"]}).status_code == 400
    assert ana.patch(f"/api/v1/folders/{raiz['id']}", {"parent_id": raiz["id"]}).status_code == 400
    # renomear e mover para a raiz
    r = ana.patch(f"/api/v1/folders/{neta['id']}", {"name": "Neta 2", "parent_id": None})
    assert r.status_code == 200 and r.json()["parent_id"] is None and r.json()["name"] == "Neta 2"
    assert len(ana.get(f"/api/v1/folders?subject_id={s1['id']}").json()) == 3


def test_excluir_pasta_preserva_aulas_e_subpastas(ana):
    s = ana.subject()
    raiz = ana.folder(s["id"], "Raiz")
    meio = ana.folder(s["id"], "Meio", raiz["id"])
    filha = ana.folder(s["id"], "Filha", meio["id"])
    aula = ana.lesson(s["id"], folder_id=meio["id"])
    assert ana.delete(f"/api/v1/folders/{meio['id']}").status_code == 204
    pastas = {f["id"]: f for f in ana.get("/api/v1/folders").json()}
    assert meio["id"] not in pastas and pastas[filha["id"]]["parent_id"] == raiz["id"]
    assert ana.get(f"/api/v1/lessons/{aula['id']}").json()["folder_id"] is None


# ---------- aulas, textos e anotações ----------

def test_aula_com_texto_original_e_detalhe(ana):
    s = ana.subject()
    aula = ana.lesson(
        s["id"], "Fotossíntese", lesson_date="2026-10-20", observations="cai na prova",
        content="Plantas convertem luz em energia.", origin="pasted",
    )
    assert len(aula["materials"]) == 1
    m = aula["materials"][0]
    assert m["content"] == "Plantas convertem luz em energia." and m["origin"] == "pasted"
    assert len(m["content_hash"]) == 64
    assert ana.get(f"/api/v1/lessons/{aula['id']}").json()["observations"] == "cai na prova"


def test_aula_sem_texto_nao_cria_material(ana):
    aula = ana.lesson(ana.subject()["id"], content="   ")
    assert aula["materials"] == []


def test_editar_texto_atualiza_hash_e_preserva_conteudo_exato(ana):
    aula = ana.lesson(ana.subject()["id"], content="  original com espaços  ")
    m = aula["materials"][0]
    assert m["content"] == "  original com espaços  "
    r = ana.patch(f"/api/v1/materials/{m['id']}", {"content": "novo texto"})
    assert r.status_code == 200 and r.json()["content_hash"] != m["content_hash"]
    assert ana.patch(f"/api/v1/materials/{m['id']}", {"content": "   "}).status_code == 422
    assert ana.post(f"/api/v1/lessons/{aula['id']}/materials", {"content": "x" * 100_001}).status_code == 422
    assert ana.delete(f"/api/v1/materials/{m['id']}").status_code == 204
    assert ana.get(f"/api/v1/lessons/{aula['id']}").json()["materials"] == []


def test_anotacoes_crud(ana):
    aula = ana.lesson(ana.subject()["id"])
    n = ana.post(f"/api/v1/lessons/{aula['id']}/notes", {"content": "lembrar"}).json()
    assert ana.patch(f"/api/v1/notes/{n['id']}", {"content": "lembrar muito"}).json()["content"] == "lembrar muito"
    assert len(ana.get(f"/api/v1/lessons/{aula['id']}").json()["notes"]) == 1
    assert ana.delete(f"/api/v1/notes/{n['id']}").status_code == 204
    assert ana.post(f"/api/v1/lessons/{aula['id']}/notes", {"content": ""}).status_code == 422


def test_atualizar_aula_favoritar_e_mover(ana):
    s1, s2 = ana.subject("A"), ana.subject("B")
    f1 = ana.folder(s1["id"])
    aula = ana.lesson(s1["id"], folder_id=f1["id"])
    assert ana.patch(f"/api/v1/lessons/{aula['id']}", {"is_favorite": True}).json()["is_favorite"] is True
    # mudar de matéria sem informar pasta tira a aula da pasta antiga
    r = ana.patch(f"/api/v1/lessons/{aula['id']}", {"subject_id": s2["id"]})
    assert r.json()["subject_id"] == s2["id"] and r.json()["folder_id"] is None
    # pasta de outra matéria é recusada
    assert ana.patch(f"/api/v1/lessons/{aula['id']}", {"folder_id": f1["id"]}).status_code == 400
    # enviar title=null não apaga o título
    assert ana.patch(f"/api/v1/lessons/{aula['id']}", {"title": None}).json()["title"] == "Aula 1"


def test_excluir_aula(ana):
    aula = ana.lesson(ana.subject()["id"], content="texto")
    assert ana.delete(f"/api/v1/lessons/{aula['id']}").status_code == 204
    assert ana.get(f"/api/v1/lessons/{aula['id']}").status_code == 404


# ---------- biblioteca: listagem, filtros e pesquisa ----------

def test_paginacao_e_ordenacao(ana):
    s = ana.subject()
    for t in ["Delta", "Alfa", "Charlie", "Bravo", "Echo"]:
        ana.lesson(s["id"], t)
    p1 = ana.get("/api/v1/lessons?sort=title&order=asc&page=1&page_size=2").json()
    p3 = ana.get("/api/v1/lessons?sort=title&order=asc&page=3&page_size=2").json()
    assert p1["total"] == 5 and [i["title"] for i in p1["items"]] == ["Alfa", "Bravo"]
    assert [i["title"] for i in p3["items"]] == ["Echo"]
    assert ana.get("/api/v1/lessons?page_size=101").status_code == 422
    assert ana.get("/api/v1/lessons?sort=senha_hash").status_code == 422


def test_recentes_e_filtros(ana):
    s1, s2 = ana.subject("A"), ana.subject("B")
    a = ana.lesson(s1["id"], "Primeira")
    b = ana.lesson(s2["id"], "Segunda", lesson_date="2026-09-01")
    ana.patch(f"/api/v1/lessons/{a['id']}", {"is_favorite": True})
    ana.post(f"/api/v1/lessons/{b['id']}/notes", {"content": "mexeu"})  # b vira a mais recente
    itens = ana.get("/api/v1/lessons").json()["items"]
    assert [i["title"] for i in itens] == ["Segunda", "Primeira"]
    assert itens[0]["subject_name"] == "B"
    assert [i["title"] for i in ana.get("/api/v1/lessons?favorite=true").json()["items"]] == ["Primeira"]
    assert [i["title"] for i in ana.get(f"/api/v1/lessons?subject_id={s2['id']}").json()["items"]] == ["Segunda"]
    assert [i["title"] for i in ana.get("/api/v1/lessons?date_from=2026-08-01").json()["items"]] == ["Segunda"]


def test_pesquisa_por_titulo_parcial_e_conteudo(ana):
    s = ana.subject()
    ana.lesson(s["id"], "Fotossíntese das plantas")
    ana.lesson(s["id"], "Revolução Francesa", content="A mitocôndria produz energia nas células.")
    ana.lesson(s["id"], "Outra coisa")
    titulos = lambda q: [i["title"] for i in ana.get("/api/v1/lessons", params={"q": q}).json()["items"]]
    assert titulos("planta") == ["Fotossíntese das plantas"]  # radical em português
    assert titulos("Revol") == ["Revolução Francesa"]  # trecho do título
    assert titulos("mitocôndria") == ["Revolução Francesa"]  # texto original
    assert titulos("inexistente") == []


def test_pesquisa_trata_curingas_como_texto(ana):
    s = ana.subject()
    ana.lesson(s["id"], "Aula 100% prática")
    ana.lesson(s["id"], "Aula teórica")
    resultado = ana.get("/api/v1/lessons", params={"q": "%"}).json()["items"]
    assert [i["title"] for i in resultado] == ["Aula 100% prática"]


# ---------- ISOLAMENTO ENTRE USUÁRIOS ----------

@pytest.fixture
def dados_da_bia(bia):
    s = bia.subject("Física Secreta")
    f = bia.folder(s["id"], "Pasta da Bia")
    aula = bia.lesson(s["id"], "Aula Secreta da Bia", folder_id=f["id"], content="segredo-da-bia quantum")
    m = aula["materials"][0]
    n = bia.post(f"/api/v1/lessons/{aula['id']}/notes", {"content": "nota da bia"}).json()
    return {"subject": s, "folder": f, "lesson": aula, "material": m, "note": n}


def test_usuario_nao_ve_nem_lista_dados_de_outro(ana, dados_da_bia):
    d = dados_da_bia
    for url in (
        f"/api/v1/subjects/{d['subject']['id']}",
        f"/api/v1/lessons/{d['lesson']['id']}",
    ):
        assert ana.get(url).status_code == 404
    assert ana.get("/api/v1/subjects").json()["total"] == 0
    assert ana.get("/api/v1/lessons").json()["total"] == 0
    assert ana.get("/api/v1/folders").json() == []
    assert ana.get("/api/v1/folders", params={"subject_id": d["subject"]["id"]}).json() == []
    # pesquisa e filtros não vazam
    assert ana.get("/api/v1/lessons", params={"q": "segredo-da-bia"}).json()["total"] == 0
    assert ana.get("/api/v1/lessons", params={"q": "quantum"}).json()["total"] == 0
    assert ana.get("/api/v1/lessons", params={"subject_id": d["subject"]["id"]}).json()["total"] == 0
    assert ana.get("/api/v1/lessons", params={"folder_id": d["folder"]["id"]}).json()["total"] == 0


def test_usuario_nao_altera_dados_de_outro(ana, bia, dados_da_bia):
    d = dados_da_bia
    tentativas = [
        ("patch", f"/api/v1/subjects/{d['subject']['id']}", {"name": "invadida"}),
        ("patch", f"/api/v1/folders/{d['folder']['id']}", {"name": "invadida"}),
        ("patch", f"/api/v1/lessons/{d['lesson']['id']}", {"title": "invadida", "is_favorite": True}),
        ("patch", f"/api/v1/materials/{d['material']['id']}", {"content": "adulterado"}),
        ("patch", f"/api/v1/notes/{d['note']['id']}", {"content": "adulterada"}),
        ("post", f"/api/v1/lessons/{d['lesson']['id']}/materials", {"content": "injetado"}),
        ("post", f"/api/v1/lessons/{d['lesson']['id']}/notes", {"content": "injetada"}),
    ]
    for metodo, url, corpo in tentativas:
        assert getattr(ana, metodo)(url, corpo).status_code == 404, (metodo, url)


def test_usuario_nao_exclui_dados_de_outro(ana, bia, dados_da_bia, db):
    d = dados_da_bia
    for url in (
        f"/api/v1/notes/{d['note']['id']}",
        f"/api/v1/materials/{d['material']['id']}",
        f"/api/v1/lessons/{d['lesson']['id']}",
        f"/api/v1/folders/{d['folder']['id']}",
        f"/api/v1/subjects/{d['subject']['id']}",
    ):
        assert ana.delete(url).status_code == 404, url
    # tudo da Bia segue intacto e inalterado
    detalhe = bia.get(f"/api/v1/lessons/{d['lesson']['id']}").json()
    assert detalhe["title"] == "Aula Secreta da Bia" and detalhe["is_favorite"] is False
    assert detalhe["materials"][0]["content"] == "segredo-da-bia quantum"
    assert detalhe["notes"][0]["content"] == "nota da bia"
    assert db.scalar(text("SELECT count(*) FROM subjects")) == 1


def test_usuario_nao_referencia_recursos_de_outro_em_criacoes(ana, dados_da_bia):
    d = dados_da_bia
    minha = ana.subject("Minha")
    # aula em matéria alheia
    assert ana.post("/api/v1/lessons", {"subject_id": d["subject"]["id"], "title": "x"}).status_code == 404
    # aula minha em pasta alheia
    r = ana.post("/api/v1/lessons", {"subject_id": minha["id"], "title": "x", "folder_id": d["folder"]["id"]})
    assert r.status_code == 404
    # pasta em matéria alheia / com pai alheio
    assert ana.post("/api/v1/folders", {"subject_id": d["subject"]["id"], "name": "x"}).status_code == 404
    r = ana.post("/api/v1/folders", {"subject_id": minha["id"], "name": "x", "parent_id": d["folder"]["id"]})
    assert r.status_code == 404
    # mover aula minha para matéria/pasta alheia
    aula = ana.lesson(minha["id"])
    assert ana.patch(f"/api/v1/lessons/{aula['id']}", {"subject_id": d["subject"]["id"]}).status_code == 404
    assert ana.patch(f"/api/v1/lessons/{aula['id']}", {"folder_id": d["folder"]["id"]}).status_code == 404


def test_user_id_no_corpo_e_ignorado(ana, bia):
    s = ana.post(
        "/api/v1/subjects", {"name": "Minha", "user_id": str(uuid.uuid4())}
    ).json()
    assert ana.get(f"/api/v1/subjects/{s['id']}").status_code == 200
    assert bia.get(f"/api/v1/subjects/{s['id']}").status_code == 404


def test_mesmo_nome_de_materia_para_usuarios_diferentes(ana, bia):
    ana.subject("Matemática")
    bia.subject("Matemática")  # não conflita entre usuários


def test_rotas_exigem_autenticacao_e_csrf(app, ana):
    anon = TestClient(app)
    s = ana.subject()
    for url in ("/api/v1/subjects", "/api/v1/lessons", "/api/v1/folders", f"/api/v1/subjects/{s['id']}"):
        assert anon.get(url).status_code == 401, url
    assert anon.post("/api/v1/subjects", json={"name": "x"}).status_code == 401
    # logada, mas sem token CSRF
    assert ana.c.post("/api/v1/subjects", json={"name": "y"}).status_code == 403
    assert ana.c.delete(f"/api/v1/subjects/{s['id']}").status_code == 403
    assert ana.get(f"/api/v1/subjects/{s['id']}").status_code == 200


def test_ids_malformados_retornam_422(ana):
    assert ana.get("/api/v1/lessons/nao-e-uuid").status_code == 422
    assert ana.get(f"/api/v1/lessons/{uuid.uuid4()}").status_code == 404
