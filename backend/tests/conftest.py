"""Fixtures de banco: cria um banco de testes próprio e aplica as migrations reais."""

import os
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.core.db import get_db
from app.main import create_app

BACKEND_DIR = Path(__file__).resolve().parents[1]
TEST_DB_NAME = "estudos_test"


def _urls() -> tuple[str, str]:
    base = make_url(os.environ.get("TEST_DATABASE_URL") or get_settings().database_url)
    admin = base.set(database="postgres").render_as_string(hide_password=False)
    test = base.set(database=TEST_DB_NAME).render_as_string(hide_password=False)
    return admin, test


@pytest.fixture(scope="session")
def engine():
    admin_url, test_url = _urls()
    admin = create_engine(admin_url, isolation_level="AUTOCOMMIT")
    try:
        with admin.connect() as c:
            c.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))
            c.execute(text(f'CREATE DATABASE "{TEST_DB_NAME}"'))
    except OperationalError:  # banco indisponível: pula testes de integração
        pytest.skip("PostgreSQL indisponível para testes de integração")
    env = {**os.environ, "ALEMBIC_DATABASE_URL": test_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR, env=env, check=True,
    )
    eng = create_engine(test_url)
    yield eng
    eng.dispose()
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE IF EXISTS "{TEST_DB_NAME}" WITH (FORCE)'))


PASSWORD = "senha-segura-123"


class SpyMailer:
    def __init__(self):
        self.sent: list[tuple[str, str]] = []

    def send_password_reset(self, to_email: str, token: str) -> None:
        self.sent.append((to_email, token))


def build_app(db, **overrides):
    app = create_app(Settings(app_env="test", **overrides))
    app.dependency_overrides[get_db] = lambda: db
    app.state.mailer = SpyMailer()
    return app


def register(client, email="ana@example.com", password=PASSWORD):
    r = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert r.status_code == 201, r.text
    return r.json()


def csrf(data):
    return {"X-CSRF-Token": data["csrf_token"]}


@pytest.fixture
def app(db):
    return build_app(db)


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def db(engine):
    """Sessão em transação que é desfeita ao fim de cada teste."""
    conn = engine.connect()
    trans = conn.begin()
    session = Session(bind=conn, join_transaction_mode="create_savepoint")
    yield session
    session.close()
    trans.rollback()
    conn.close()
