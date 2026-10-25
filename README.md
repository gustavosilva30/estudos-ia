# Estudos IA

Plataforma web de estudos pessoais com IA: matérias, aulas, resumos, preparação para aulas e revisão.

**Stack:** Next.js + TypeScript + Tailwind (frontend) · FastAPI + SQLAlchemy 2 + Alembic (backend) · PostgreSQL próprio · IA via API, independente de fornecedor. Sem Supabase, Firebase ou Capacitor.

## Estado atual
Etapas E0–E6 concluídas: o MVP está utilizável de ponta a ponta (cadastro, matérias, aulas, textos, IA de demonstração, resumos editáveis com versões, pesquisa). Próxima: **E7** (endurecimento, deploy no EasyPanel, backup).
Detalhes e pendências em [docs/roadmap.md](docs/roadmap.md). A IA usa apenas o provedor de teste (`fake`); nenhum fornecedor real está integrado.

## Desenvolvimento rápido
```bash
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml --env-file .env up -d      # PostgreSQL (precisa do Docker aberto)
cd backend && python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"   # Linux/Mac: .venv/bin/pip
.venv/Scripts/python -m alembic upgrade head                              # cria as tabelas
.venv/Scripts/python -m pytest                                            # testes (usam um banco próprio, estudos_test)
.venv/Scripts/python -m uvicorn app.main:app --reload --host 127.0.0.1    # http://127.0.0.1:8000/api/docs
cd ../frontend && npm install && npm run dev                              # http://localhost:3000
```
Use `127.0.0.1` (não `localhost`) para o banco e o backend no Windows.

## Documentação
[roadmap](docs/roadmap.md) · [banco de dados](docs/banco-de-dados.md) · [segurança e autenticação](docs/seguranca.md) ·
[API da biblioteca](docs/api-biblioteca.md) · [IA e resumos](docs/ia.md) · [frontend](docs/frontend.md)
