from datetime import UTC, datetime, timedelta

from conftest import PASSWORD, build_app, csrf, register
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.core.deps import require_role

# ---------- cadastro ----------

def test_cadastro_cria_sessao_com_cookie_protegido(client):
    r = client.post("/api/v1/auth/register", json={"email": "Ana@Example.com", "password": PASSWORD})
    assert r.status_code == 201
    body = r.json()
    assert body["user"]["email"] == "ana@example.com"
    assert body["preferences"]["theme"] == "system"
    assert "password" not in r.text and "hash" not in r.text
    cookie = r.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/v1/users/me").status_code == 200


def test_cadastro_email_duplicado_ignora_maiusculas(client):
    register(client, "ana@example.com")
    r = TestClient(client.app).post(
        "/api/v1/auth/register", json={"email": "ANA@example.com", "password": PASSWORD}
    )
    assert r.status_code == 409


def test_cadastro_senha_curta_e_email_invalido(client):
    assert client.post("/api/v1/auth/register", json={"email": "a@example.com", "password": "curta"}).status_code == 422
    assert client.post("/api/v1/auth/register", json={"email": "nao-e-email", "password": PASSWORD}).status_code == 422


def test_cadastro_pode_ser_desligado(db):
    c = TestClient(build_app(db, registration_enabled=False))
    r = c.post("/api/v1/auth/register", json={"email": "a@example.com", "password": PASSWORD})
    assert r.status_code == 403


# ---------- login ----------

def test_login_ok_e_mensagem_igual_para_falhas(client):
    register(client)
    outro = TestClient(client.app)
    ok = outro.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD})
    assert ok.status_code == 200
    errada = TestClient(client.app).post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": "senha-errada-123"}
    )
    inexistente = TestClient(client.app).post(
        "/api/v1/auth/login", json={"email": "ninguem@example.com", "password": PASSWORD}
    )
    assert errada.status_code == inexistente.status_code == 401
    assert errada.json() == inexistente.json()


def test_login_limita_tentativas(db):
    c = TestClient(build_app(db, rate_limit_login_pair=3))
    for _ in range(3):
        r = c.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "qualquer"})
        assert r.status_code == 401
    r = c.post("/api/v1/auth/login", json={"email": "x@example.com", "password": "qualquer"})
    assert r.status_code == 429
    assert "retry-after" in r.headers


def test_conta_inativa_nao_entra(client, db):
    register(client)
    db.execute(text("UPDATE users SET is_active = false"))
    r = TestClient(client.app).post(
        "/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}
    )
    assert r.status_code == 401


# ---------- sessão, CSRF e origem ----------

def test_rotas_protegidas_exigem_login(client):
    assert client.get("/api/v1/users/me").status_code == 401
    assert client.patch("/api/v1/users/me", json={"display_name": "x"}).status_code == 401


def test_csrf_obrigatorio_em_metodos_que_alteram_dados(client):
    data = register(client)
    url = "/api/v1/users/me"
    assert client.patch(url, json={"display_name": "Ana"}).status_code == 403
    assert client.patch(url, json={"display_name": "Ana"}, headers={"X-CSRF-Token": "errado"}).status_code == 403
    r = client.patch(url, json={"display_name": "Ana"}, headers=csrf(data))
    assert r.status_code == 200
    assert r.json()["user"]["display_name"] == "Ana"


def test_origem_externa_e_recusada(client):
    data = register(client)
    r = client.patch(
        "/api/v1/users/me", json={"display_name": "x"},
        headers={**csrf(data), "Origin": "https://site-malicioso.example"},
    )
    assert r.status_code == 403
    ok = client.patch(
        "/api/v1/users/me", json={"display_name": "x"},
        headers={**csrf(data), "Origin": "http://localhost:3000"},
    )
    assert ok.status_code == 200


def test_logout_invalida_o_token(client):
    data = register(client)
    token = client.cookies.get("estudos_session")
    assert client.post("/api/v1/auth/logout", headers=csrf(data)).status_code == 204
    replay = TestClient(client.app, cookies={"estudos_session": token})
    assert replay.get("/api/v1/users/me").status_code == 401


def test_sessao_expirada_e_recusada(client, db):
    register(client)
    past = datetime.now(UTC) - timedelta(minutes=1)
    db.execute(text("UPDATE user_sessions SET expires_at = :p"), {"p": past})
    assert client.get("/api/v1/users/me").status_code == 401


def test_token_de_sessao_nao_fica_em_texto_puro_no_banco(client, db):
    register(client)
    token = client.cookies.get("estudos_session")
    stored = db.scalar(text("SELECT token_hash FROM user_sessions"))
    assert stored != token and len(stored) == 64


def test_papeis_protegem_rotas_futuras(app, client):
    admin = require_role("admin")

    @app.get("/api/v1/_admin-teste")
    def admin_only(ctx=Depends(admin)):
        return {"ok": True}

    register(client)
    assert client.get("/api/v1/_admin-teste").status_code == 403


# ---------- perfil e preferências ----------

def test_preferencias_validadas_e_persistidas(client):
    data = register(client)
    h = csrf(data)
    r = client.patch("/api/v1/users/me/preferences", json={"theme": "dark", "daily_ai_limit": 5}, headers=h)
    assert r.status_code == 200
    assert r.json()["preferences"]["theme"] == "dark"
    assert client.get("/api/v1/users/me").json()["preferences"]["daily_ai_limit"] == 5
    assert client.patch("/api/v1/users/me/preferences", json={"theme": "neon"}, headers=h).status_code == 422


def test_cada_usuario_ve_apenas_o_proprio_perfil(app):
    a, b = TestClient(app), TestClient(app)
    da = register(a, "a@example.com")
    register(b, "b@example.com")
    # Um user_id/email enviado no corpo é ignorado: a identidade vem da sessão.
    r = a.patch(
        "/api/v1/users/me",
        json={"display_name": "A", "id": "00000000-0000-0000-0000-000000000000", "email": "b@example.com"},
        headers=csrf(da),
    )
    assert r.status_code == 200
    assert a.get("/api/v1/users/me").json()["user"]["email"] == "a@example.com"
    assert b.get("/api/v1/users/me").json()["user"]["display_name"] is None


# ---------- senha ----------

def test_troca_de_senha_mantem_sessao_atual_e_encerra_as_outras(app):
    a1, a2 = TestClient(app), TestClient(app)
    d1 = register(a1)
    a2.post("/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD})
    nova = "outra-senha-forte-456"
    h = csrf(d1)
    assert a1.post("/api/v1/users/me/password", json={"current_password": "errada", "new_password": nova}, headers=h).status_code == 400
    assert a1.post("/api/v1/users/me/password", json={"current_password": PASSWORD, "new_password": nova}, headers=h).status_code == 204
    assert a1.get("/api/v1/users/me").status_code == 200
    assert a2.get("/api/v1/users/me").status_code == 401
    novo = TestClient(app).post("/api/v1/auth/login", json={"email": "ana@example.com", "password": nova})
    assert novo.status_code == 200


def test_recuperacao_de_senha_completa(app, client):
    register(client)
    mailer = app.state.mailer
    anon = TestClient(app)
    r = anon.post("/api/v1/auth/password-reset/request", json={"email": "ana@example.com"})
    desconhecido = anon.post("/api/v1/auth/password-reset/request", json={"email": "ninguem@example.com"})
    assert r.status_code == desconhecido.status_code == 202
    assert r.json() == desconhecido.json()
    assert len(mailer.sent) == 1  # nada enviado para e-mail inexistente
    token = mailer.sent[0][1]

    nova = "senha-nova-recuperada-789"
    assert anon.post("/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": nova}).status_code == 204
    # uso único
    assert anon.post("/api/v1/auth/password-reset/confirm", json={"token": token, "new_password": nova}).status_code == 400
    # sessões antigas encerradas, senha antiga inválida, nova válida
    assert client.get("/api/v1/users/me").status_code == 401
    assert TestClient(app).post("/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD}).status_code == 401
    assert TestClient(app).post("/api/v1/auth/login", json={"email": "ana@example.com", "password": nova}).status_code == 200


def test_token_de_recuperacao_expirado_ou_falso(app, client, db):
    register(client)
    anon = TestClient(app)
    anon.post("/api/v1/auth/password-reset/request", json={"email": "ana@example.com"})
    token = app.state.mailer.sent[0][1]
    db.execute(text("UPDATE password_resets SET expires_at = now() - interval '1 minute'"))
    body = {"token": token, "new_password": "senha-nova-recuperada-789"}
    assert anon.post("/api/v1/auth/password-reset/confirm", json=body).status_code == 400
    body["token"] = "x" * 43
    assert anon.post("/api/v1/auth/password-reset/confirm", json=body).status_code == 400


def test_recuperacao_limita_pedidos_por_email(app):
    anon = TestClient(app)
    codes = [
        anon.post("/api/v1/auth/password-reset/request", json={"email": "ana@example.com"}).status_code
        for _ in range(4)
    ]
    assert codes == [202, 202, 202, 429]


# ---------- exclusão de conta ----------

def test_exclusao_de_conta_apaga_tudo(client, db):
    data = register(client)
    h = csrf(data)
    assert client.request("DELETE", "/api/v1/users/me", json={"password": "errada"}, headers=h).status_code == 400
    assert client.request("DELETE", "/api/v1/users/me", json={"password": PASSWORD}, headers=h).status_code == 204
    for table in ("users", "user_sessions", "user_preferences"):
        assert db.scalar(text(f"SELECT count(*) FROM {table}")) == 0
    r = TestClient(client.app).post("/api/v1/auth/login", json={"email": "ana@example.com", "password": PASSWORD})
    assert r.status_code == 401


# ---------- cabeçalhos ----------

def test_cabecalhos_de_seguranca_e_id_de_requisicao(client):
    r = client.get("/api/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"
    assert r.headers["x-request-id"]
