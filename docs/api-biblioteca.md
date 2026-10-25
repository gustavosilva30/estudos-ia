# API da biblioteca (E3)

Todos os endpoints exigem sessão; os que alteram dados exigem também `X-CSRF-Token` (ver [seguranca.md](seguranca.md)).
Documentação interativa (somente em desenvolvimento): `/api/docs`.

## Regras de isolamento
- O `user_id` vem **somente** da sessão. Corpo, query string e URL nunca definem o dono.
- `app/repositories/library.py` filtra toda consulta por `user_id`; `app/services/library.py` valida a
  propriedade de **cada id referenciado** (matéria, pasta pai, pasta da aula…).
- Recurso inexistente **ou de outro usuário** → 404 com a mesma mensagem (não revela existência).
- Segunda barreira no banco: FKs compostas `(id, user_id)` (ver [banco-de-dados.md](banco-de-dados.md)).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/subjects` | Lista paginada (`include_archived`, `page`, `page_size`) com `lesson_count` |
| POST | `/api/v1/subjects` | Cria matéria (nome único por usuário → 409 se repetido) |
| GET/PATCH/DELETE | `/api/v1/subjects/{id}` | Detalhe / edita (inclui arquivar) / exclui com todo o conteúdo |
| GET | `/api/v1/folders?subject_id=` | Pastas do usuário (opcionalmente de uma matéria) |
| POST | `/api/v1/folders` | Cria pasta (`parent_id` opcional, mesma matéria) |
| PATCH | `/api/v1/folders/{id}` | Renomeia / move (`parent_id: null` = raiz); bloqueia ciclos |
| DELETE | `/api/v1/folders/{id}` | Aulas voltam à raiz da matéria e subpastas sobem um nível (nada é apagado) |
| GET | `/api/v1/lessons` | Biblioteca paginada: ver filtros abaixo |
| POST | `/api/v1/lessons` | Cria aula; `content` opcional salva o texto original junto |
| GET/PATCH/DELETE | `/api/v1/lessons/{id}` | Detalhe (com textos e anotações) / edita, favorita, move / exclui |
| POST | `/api/v1/lessons/{id}/materials` | Adiciona texto original (`typed` ou `pasted`) |
| PATCH/DELETE | `/api/v1/materials/{id}` | Edita (recalcula `content_hash`) / exclui |
| POST | `/api/v1/lessons/{id}/notes` | Adiciona anotação pessoal |
| PATCH/DELETE | `/api/v1/notes/{id}` | Edita / exclui |

### `GET /api/v1/lessons`
`q` (busca), `subject_id`, `folder_id`, `favorite`, `date_from`, `date_to`,
`sort` (`updated_at` padrão, `created_at`, `title`, `lesson_date`), `order` (`desc` padrão, `asc`),
`page` (≥1), `page_size` (1–100, padrão 20). Resposta: `{items, total, page, page_size}`.

**Pesquisa (`q`):** busca em português (radicais, via `websearch_to_tsquery`) no título e nos textos originais,
mais trecho literal no título (`%`/`_` são tratados como texto). Anotações e observações ainda **não** entram na busca.
**Recentes:** `sort=updated_at&order=desc`; adicionar/editar texto ou anotação atualiza `updated_at` da aula.

## Pesquisa global (E6)
`GET /api/v1/search?q=` (2–200 caracteres) devolve, no máximo, 8 itens de cada grupo, com o total de aulas/resumos encontrados:
- **matérias** pelo nome (trecho literal);
- **aulas** pelo título e pelos textos originais (mesma busca da biblioteca);
- **resumos** pelo título e conteúdo, com `snippet` em que os termos vêm entre `<<` e `>>` (texto puro; o frontend os converte em destaque sem usar HTML).
Tudo filtrado pelo usuário da sessão; `%` e `_` são tratados como texto. Anotações e observações ainda não entram na busca.

## Limites
Texto original: 100.000 caracteres · anotação: 20.000 · observações: 5.000 · título: 200 · corpo da requisição: `MAX_BODY_BYTES`.
Texto vazio ou só com espaços é recusado (422); o conteúdo original é salvo exatamente como enviado (sem `strip`).

## Testes
`backend/tests/test_library.py`: CRUD, hierarquia de pastas, paginação/ordenação/filtros, pesquisa, e a bateria de
**isolamento entre usuários** — outro usuário não consegue listar, pesquisar, ler, alterar, excluir nem *referenciar*
(em criações e movimentações) matérias, pastas, aulas, textos e anotações; `user_id` enviado no corpo é ignorado; e os dados
da vítima permanecem intactos após as tentativas.
