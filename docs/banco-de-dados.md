# Banco de dados (PostgreSQL)

PostgreSQL próprio, acessado só pelo backend (SQLAlchemy 2 + psycopg 3). Migrations versionadas com Alembic em `backend/alembic/versions/`.

## Convenções
- Chaves primárias UUID (`gen_random_uuid()`).
- `created_at` / `updated_at` em `timestamptz` (`updated_at` atualizado pelo SQLAlchemy).
- Restrições com nomes padronizados (`pk_`, `fk_`, `uq_`, `ck_`, `ix_`).
- Valores restritos (papel, tema, origem) usam `CHECK`, não enums nativos, para facilitar migrations.

## Isolamento por usuário
Toda tabela privada tem `user_id NOT NULL` com FK para `users` e `ON DELETE CASCADE`.
Além disso, as chaves estrangeiras **entre tabelas privadas são compostas** `(id, user_id)`: o próprio
PostgreSQL recusa ligar, por exemplo, uma aula do usuário A a uma matéria do usuário B. É uma segunda
barreira; a principal continua sendo o backend, que filtra todas as consultas pelo usuário da sessão.

## Tabelas da E1

| Tabela | Descrição | Pontos de integridade |
|---|---|---|
| `users` | Contas | e-mail único por `lower(email)`; `role` ∈ {user, admin}; `is_active` |
| `user_sessions` | Sessões de login | guarda só o hash do token; `expires_at` indexado; cascata do usuário |
| `password_resets` | Tokens de recuperação | hash único, expiração, `used_at` |
| `user_preferences` | 1 linha por usuário (PK = `user_id`) | tema, nível de detalhe e limite diário de IA validados |
| `subjects` | Matérias | nome único por usuário; nome não vazio |
| `folders` | Pastas (hierárquicas) por matéria | pai do mesmo usuário; não pode ser pai de si mesma |
| `lessons` | Aulas | matéria/pasta do mesmo usuário; `search_vector` (tsvector português, GIN) |
| `source_materials` | Texto original | conteúdo não vazio; `content_hash` SHA-256; origem ∈ {typed, pasted, image, pdf, link}; `source_name` (nome do PDF ou endereço do link); `search_vector` (GIN) |
| `notes` | Anotações pessoais | aula do mesmo usuário |

## Políticas de exclusão
- Excluir usuário → apaga tudo dele (cascata).
- Excluir matéria → apaga pastas, aulas, textos e anotações.
- Pastas: a FK de pasta (pai e aula→pasta) **não** tem cascata. O serviço de pastas (E3) deve mover os
  itens antes de excluir; o banco recusa a exclusão se ainda houver filhos.
- O texto original (`source_materials`) é só alterado pelo usuário; nenhuma operação de IA o sobrescreve.

## Tabelas da E4 (migration 0002)
`ai_generations`, `ai_usage_logs`, `summaries`, `summary_versions` — ver [ia.md](ia.md).
`summaries.generation_id` usa `ON DELETE SET NULL (generation_id)` (PostgreSQL 15+) para preservar `user_id`.

## Tabelas e mudanças da E8 (migration 0003)
- `subjects.category` (texto, padrão `outro`): área de conhecimento (Matemática, Física...). Validada na aplicação
  (`app/ai/profiles.py`), sem `CHECK`, para a lista poder crescer sem migration.
- `attachments`: imagens enviadas (bytes em `BYTEA`, coluna carregada só sob demanda). Pertencem a uma **aula**
  (FK composta `(lesson_id, user_id)`, cascata). Únicas por `(user_id, lesson_id, sha256)`. `CHECK` de tipo
  (`image/jpeg|png|webp`) e tamanho > 0.
- `ai_generations.material_id` agora aceita `NULL` e há `attachment_id` (FK composta, cascata). `CHECK`
  `num_nonnulls(material_id, attachment_id) = 1`: a origem é **um texto OU uma imagem**. Nova chave única de anti-duplicação
  para imagens.
- Migration 0004 (`infra/sql/0004-documentos-e-links.sql`): `source_materials.origin` aceita `pdf` e `link` e ganha `source_name`.
- `source_materials.origin` aceita também `image` (texto transcrito de uma imagem e revisado pelo usuário).
- Excluir a imagem apaga as gerações dela; **resumos já salvos permanecem** (`summaries.generation_id` vira NULL).
- Atenção ao backup: as imagens ficam no PostgreSQL, então aumentam o tamanho do banco e do `pg_dump` (limite de 200 MB por usuário).

SQL equivalente (para aplicar à mão): `infra/sql/0003-imagens-e-categorias.sql` (parte da versão 0002, que já estava aplicada).

## Tabelas planejadas (Fase 3)
`questions`, `flashcards`, `study_sessions`, `review_schedule`.

## Comandos
```bash
cd backend
.venv/Scripts/python -m alembic upgrade head      # aplicar
.venv/Scripts/python -m alembic downgrade -1      # desfazer a última (só em desenvolvimento)
.venv/Scripts/python -m alembic revision --autogenerate -m "descrição"   # nova migration (revise sempre)
```
Em produção, `upgrade head` é uma etapa explícita de deploy e só roda com autorização; nunca execute
`downgrade` nem alterações destrutivas em produção sem backup e aprovação.

## Testes
`backend/tests/test_models_db.py` cria o banco `estudos_test` no PostgreSQL do compose, aplica as
migrations reais e valida restrições, isolamento entre usuários, cascatas e busca em português.
Se o PostgreSQL estiver desligado, esses testes são ignorados (skip).
