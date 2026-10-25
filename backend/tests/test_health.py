from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def test_health_ok():
    client = TestClient(create_app(Settings(app_env="test")))
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_docs_disponivel_em_desenvolvimento():
    client = TestClient(create_app(Settings(app_env="development")))
    assert client.get("/api/docs").status_code == 200


def test_docs_desabilitada_em_producao():
    client = TestClient(create_app(Settings(app_env="production")))
    assert client.get("/api/docs").status_code == 404
    assert client.get("/api/openapi.json").status_code == 404


def test_corpo_grande_demais_e_rejeitado():
    client = TestClient(create_app(Settings(app_env="test", max_body_bytes=10)))
    r = client.post("/api/health", content=b"x" * 100)
    assert r.status_code == 413
