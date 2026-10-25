# Camada de IA e resumos (E4)

## Visão geral
```
endpoint /api/v1/ai/generate
  → services/ai.py   (propriedade, cache, cotas, retries, validação, custos)
      → ai/operations.py  (prompt + schema por operação)
      → LLMProvider.complete()   ← única fronteira com o fornecedor
  → ai/render.py     (resultado estruturado → Markdown editável)
  → /api/v1/ai/generations/{id}/save → summaries (editor com versões)
```
Os módulos de estudo só conhecem `LLMProvider` (`app/ai/provider.py`). Trocar de fornecedor ou modelo =
variáveis de ambiente (`AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY`) + uma classe nova em `app/ai/providers/`.

**Estado atual:** só o `FakeProvider` (determinístico, sem custo, usado também nos testes). Nenhum fornecedor
real está integrado nem configurado; `AI_PROVIDER` desconhecido faz o backend falhar na partida.

## Operações implementadas (MVP)
`resumo_completo`, `resumo_rapido` (sem nível de detalhe), `topicos_principais`, `explicacao_simplificada`,
`preparacao_aula` (introdução, conceitos, conhecimentos prévios, vocabulário, pontos de estudo, perguntas para
reflexão, dúvidas para o professor e resumo final). Nível de detalhe: `curto` / `medio` / `detalhado`
(padrão = preferência do usuário). Perguntas e respostas, flashcards, glossário, simulados e perguntas sobre o
material são da Fase 3: bastam um modelo de resultado, instruções, renderizador e registro em `OPERATIONS`.

## Regras de conteúdo (todas as operações)
Prompt de sistema comum + instruções por operação (`app/ai/operations.py`):
usar só o material; não inventar; registrar lacunas em `limitations`; qualquer conhecimento externo só em
`complementary_info` (exibido em seção separada "Informações complementares (não estão no seu material)");
preservar termos técnicos; saída apenas em JSON do schema. Cada resposta é validada com Pydantic; resposta
inválida é repetida e, se persistir, recusada (502) sem salvar nada.

## Texto do usuário = dado não confiável
- Vai somente na mensagem de usuário, entre `<material_do_usuario>…</material_do_usuario>`.
  Marcações iguais dentro do texto são removidas (não dá para "fechar" o delimitador).
- O prompt de sistema nunca contém texto do usuário e manda ignorar ordens dentro do material
  (mudar regras/formato, revelar prompts, chaves ou credenciais).
- Chave de API, e-mail e identificadores do usuário nunca vão ao provedor. A resposta é tratada como texto.
- O texto original **nunca** é alterado ou substituído pela IA: resultados viram `ai_generations`/`summaries`.
- Limite: não é possível garantir 100% de imunidade a injeção de prompt em modelos reais; a defesa é em camadas
  (isolamento, saída estruturada validada, nenhuma ferramenta/ação concedida ao modelo, sem segredos no contexto).

## Custos e limites
| Controle | Configuração |
|---|---|
| Cache/anti-duplicação: mesmo texto + operação + nível + versão do prompt + modelo reaproveita a geração (não chama a IA, não consome cota). `force=true` regenera. | `ai_generations` (chave única) |
| Tamanho do texto enviado (413 se exceder) | `AI_MAX_INPUT_CHARS` (60.000) |
| Tamanho da resposta | `AI_MAX_OUTPUT_TOKENS` (2.000); `resumo_rapido` até 800 |
| Timeout por chamada | `AI_TIMEOUT_SECONDS` |
| Repetições em timeout / limite do provedor / resposta inválida | `AI_MAX_RETRIES`, `AI_RETRY_BACKOFF_SECONDS` |
| Ritmo por usuário | `AI_RATE_LIMIT_PER_MINUTE` (429 + `Retry-After`) |
| Cota diária por usuário (dia UTC) | preferência `daily_ai_limit` (0–200) |
| Orçamento mensal da plataforma (soma de todos; 0 = sem limite) | `AI_MONTHLY_BUDGET_USD` |
| Preço para estimar custo | `AI_PRICE_INPUT_PER_MTOK`, `AI_PRICE_OUTPUT_PER_MTOK` (USD / milhão de tokens) |

`ai_usage_logs` registra **cada chamada ao provedor** (inclusive falhas): operação, modelo, status
(`ok`/`timeout`/`rate_limited`/`error`/`invalid_output`), tokens, custo estimado e duração — nunca o conteúdo.
Tokens vêm do provedor quando informados; senão são estimados (~3,5 caracteres/token). `GET /api/v1/ai/usage` mostra o consumo do usuário.
Erros do provedor viram mensagens genéricas (504 timeout, 503 sobrecarga, 502 falha/formato); detalhes ficam só no log, sem conteúdo.

## Endpoints
| Método | Rota |
|---|---|
| GET | `/api/v1/ai/operations`, `/api/v1/ai/usage` |
| POST | `/api/v1/ai/generate` `{material_id, operation, detail_level?, force?}` |
| GET | `/api/v1/ai/generations?material_id=`, `/api/v1/ai/generations/{id}` |
| POST | `/api/v1/ai/generations/{id}/save` → cria resumo (versão 1, origem `ai`) |
| GET/POST | `/api/v1/summaries` (lista com `lesson_id`, `favorite`, `kind`, `q`, paginação; POST cria resumo manual) |
| GET/PATCH/DELETE | `/api/v1/summaries/{id}` — alterar título/conteúdo gera nova versão; favoritar não |
| GET | `/api/v1/summaries/{id}/versions` |
| POST | `/api/v1/summaries/{id}/versions/{n}/restore` (cria nova versão), `/api/v1/summaries/{id}/duplicate` |

Exportação TXT/PDF **não** está implementada (Fase 3).

## Banco (migration 0002)
`ai_generations` (resultado JSONB, chave única anti-duplicação), `ai_usage_logs`, `summaries` (conteúdo atual + busca
em português), `summary_versions` (histórico imutável). FKs compostas `(id, user_id)` como no restante.
Excluir um texto apaga suas gerações, mas **preserva** os resumos já salvos (`generation_id` vira NULL);
excluir a aula ou a conta apaga tudo.

## Como adicionar um fornecedor real
1. Criar `app/ai/providers/<nome>.py` com `name` e `complete(request) -> LLMResponse` (traduzir timeout →
   `ProviderTimeout`, 429 → `ProviderRateLimited`, demais → `ProviderError`; devolver JSON em texto e tokens quando houver).
2. Registrar em `PROVIDERS` e definir `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` (e preços) no ambiente do servidor.
3. Verificar a compatibilidade/estabilidade da biblioteca do fornecedor antes de fixar a versão.
4. Testar com chave de desenvolvimento e limites baixos; os testes automatizados continuam usando o `FakeProvider`.

## Testes
`backend/tests/test_ai.py`: todas as operações, seções da preparação para aula, texto original intacto, cache/`force`,
isolamento de prompt e ausência de segredos/e-mail no que vai ao provedor, limites de tamanho e saída, timeout/
sobrecarga/erros/resposta inválida (com registro de uso), cotas diária/por minuto/mensal e custo, validações,
isolamento entre usuários (nenhuma chamada nem custo para recurso alheio), e o ciclo de resumos
(salvar, editar, versões, restaurar, duplicar, listar/pesquisar, exclusões em cascata, isolamento).
