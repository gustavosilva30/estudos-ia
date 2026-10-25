import hashlib

import pytest
from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError

from app.models import Folder, Lesson, Note, SourceMaterial, Subject, User


def make_user(db, email="a@example.com"):
    u = User(email=email, password_hash="hash-ficticio")
    db.add(u)
    db.flush()
    return u


def make_lesson(db, user, subject_name="Biologia", title="Célula"):
    s = Subject(user_id=user.id, name=subject_name)
    db.add(s)
    db.flush()
    lesson = Lesson(user_id=user.id, subject_id=s.id, title=title)
    db.add(lesson)
    db.flush()
    return s, lesson


def test_email_unico_sem_diferenciar_maiusculas(db):
    make_user(db, "Gustavo@Example.com")
    with pytest.raises(IntegrityError):
        make_user(db, "gustavo@example.com")


def test_papel_invalido_e_rejeitado(db):
    db.add(User(email="x@example.com", password_hash="h", role="root"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_aula_nao_pode_usar_materia_de_outro_usuario(db):
    a, b = make_user(db, "a@example.com"), make_user(db, "b@example.com")
    subject_b = Subject(user_id=b.id, name="Física")
    db.add(subject_b)
    db.flush()
    db.add(Lesson(user_id=a.id, subject_id=subject_b.id, title="Invasão"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_texto_nao_pode_usar_aula_de_outro_usuario(db):
    a, b = make_user(db, "a@example.com"), make_user(db, "b@example.com")
    _, lesson_b = make_lesson(db, b)
    db.add(SourceMaterial(user_id=a.id, lesson_id=lesson_b.id, content="x", content_hash="h"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_pasta_nao_pode_ser_pai_de_si_mesma_nem_de_outro_usuario(db):
    a, b = make_user(db, "a@example.com"), make_user(db, "b@example.com")
    s_a, _ = make_lesson(db, a)
    s_b, _ = make_lesson(db, b)
    pasta_b = Folder(user_id=b.id, subject_id=s_b.id, name="Capítulo 1")
    db.add(pasta_b)
    db.flush()
    db.add(Folder(user_id=a.id, subject_id=s_a.id, parent_id=pasta_b.id, name="Filha"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_nome_de_materia_unico_por_usuario_mas_livre_entre_usuarios(db):
    a, b = make_user(db, "a@example.com"), make_user(db, "b@example.com")
    db.add_all([Subject(user_id=a.id, name="Química"), Subject(user_id=b.id, name="Química")])
    db.flush()
    db.add(Subject(user_id=a.id, name="Química"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_titulo_e_conteudo_vazios_sao_rejeitados(db):
    u = make_user(db)
    s, _lesson = make_lesson(db, u)
    db.add(Lesson(user_id=u.id, subject_id=s.id, title="   "))
    with pytest.raises(IntegrityError):
        db.flush()


def test_excluir_usuario_apaga_todos_os_seus_dados(db):
    u = make_user(db)
    _, lesson = make_lesson(db, u)
    db.add(SourceMaterial(user_id=u.id, lesson_id=lesson.id, content="texto", content_hash="h"))
    db.add(Note(user_id=u.id, lesson_id=lesson.id, content="nota"))
    db.flush()
    db.execute(text("DELETE FROM users WHERE id = :i"), {"i": u.id})
    for table in ("subjects", "lessons", "source_materials", "notes"):
        assert db.scalar(text(f"SELECT count(*) FROM {table}")) == 0


def test_excluir_materia_apaga_pastas_aulas_e_textos(db):
    u = make_user(db)
    s, lesson = make_lesson(db, u)
    pasta = Folder(user_id=u.id, subject_id=s.id, name="P")
    db.add(pasta)
    db.flush()
    lesson.folder_id = pasta.id
    db.add(SourceMaterial(user_id=u.id, lesson_id=lesson.id, content="texto", content_hash="h"))
    db.flush()
    db.execute(text("DELETE FROM subjects WHERE id = :i"), {"i": s.id})
    for table in ("folders", "lessons", "source_materials"):
        assert db.scalar(text(f"SELECT count(*) FROM {table}")) == 0


def test_pesquisa_em_portugues_por_titulo_e_conteudo(db):
    u = make_user(db)
    _, lesson = make_lesson(db, u, title="Fotossíntese das plantas")
    texto = "As células realizam respiração celular na mitocôndria."
    db.add(SourceMaterial(
        user_id=u.id, lesson_id=lesson.id, content=texto,
        content_hash=hashlib.sha256(texto.encode()).hexdigest(),
    ))
    db.flush()
    por_titulo = db.scalar(
        select(func.count()).select_from(Lesson).where(
            Lesson.search_vector.op("@@")(func.websearch_to_tsquery("portuguese", "planta"))
        )
    )
    por_conteudo = db.scalar(
        select(func.count()).select_from(SourceMaterial).where(
            SourceMaterial.search_vector.op("@@")(func.websearch_to_tsquery("portuguese", "mitocôndria"))
        )
    )
    assert por_titulo == 1
    assert por_conteudo == 1
