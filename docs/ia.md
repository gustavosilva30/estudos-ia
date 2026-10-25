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

**Provedores:** `fake` (determinístico, sem custo, usado nos testes e como padrão) e `gemini` (Google, ver abaixo).
`AI_PROVIDER` desconhecido, ou `gemini` sem `AI_API_KEY`, faz o backend falhar na partida com uma mensagem clara.

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

## Google Gemini (`AI_PROVIDER=gemini`)
Implementação: `app/ai/providers/gemini.py` (HTTP direto com `httpx`, sem SDK). Usa o **Interactions API**
(`POST /v1beta/interactions`, GA desde jun/2026 e recomendado pelo Google para projetos novos); o `generateContent`
continua suportado, mas é considerado legado. Documentação consultada em 25/10/2026:
<https://ai.google.dev/api/interactions-api> · <https://ai.google.dev/gemini-api/docs/pricing>.

**Variáveis (no EasyPanel, serviço backend):**
```
AI_PROVIDER=gemini
AI_API_KEY=<sua chave do Google AI Studio>      # só no painel, nunca no Git nem no chat
AI_MODEL=gemini-3.5-flash-lite                  # ou gemini-3.8-flash (mais capaz, mais caro)
AI_PRICE_INPUT_PER_MTOK=0.30                    # USD por milhão de tokens (confira a tabela do Google)
AI_PRICE_OUTPUT_PER_MTOK=2.50
AI_MAX_OUTPUT_TOKENS=4000
AI_MONTHLY_BUDGET_USD=5                         # trava de segurança (0 = sem limite)
# AI_THINKING_LEVEL=low                         # opcional: minimal | low | medium | high
```
| Modelo | Entrada / saída (US$ por 1 M tokens) | Observação |
|---|---|---|
| `gemini-3.5-flash-lite` | 0,30 / 2,50 | estável, o mais barato; raciocínio padrão `minimal` |
| `gemini-3.8-flash` | 0,75 / 3,75 até 31/12/2026; 1,50 / 7,50 depois | mais capaz; aceita `low`/`medium`/`high` (não `minimal`) |

Preços e nomes de modelo mudam: confira na página de preços do Google antes de fixar. A saída inclui os tokens de raciocínio.

**Pontos que importam:**
- **Raciocínio consome a saída.** O limite `max_output_tokens` inclui os tokens de "pensamento"; se estourar, a resposta vem
  truncada (`status: incomplete`). O provedor trata isso como erro **sem repetir** (repetir só gastaria mais). Se acontecer:
  aumente `AI_MAX_OUTPUT_TOKENS` ou reduza `AI_THINKING_LEVEL`. Atenção: o **resumo rápido** tem teto próprio de 800 tokens (`app/ai/operations.py`), que não muda com essa variável; com `gemini-3.8-flash` (raciocínio padrão `medium`) use `AI_THINKING_LEVEL=low`.
- **Plano gratuito x pago (privacidade):** segundo o Google, no plano **gratuito** o conteúdo enviado **pode ser usado para melhorar os produtos
  do Google**; no plano **pago** (faturamento ativado) não. Como seus textos de estudo são enviados à API, prefira uma chave de projeto **com faturamento ativado**.
- **Armazenamento:** as chamadas vão com `store: false` (o Google não guarda a interação para continuação).
- **Chave:** vai no cabeçalho `x-goog-api-key` (não na URL) e nunca é registrada em log. No Google Cloud, restrinja a chave à
  "Generative Language API" e defina um **limite de gastos/alertas** no projeto.
- **Schema:** o JSON Schema do Pydantic é simplificado antes do envio (sem `$ref`/`$defs`/limites aninhados, que podem causar erro 400);
  a validação completa continua sendo feita pelo Pydantic na resposta.
- **Custo estimado:** usa os tokens informados pelo Google (entrada, e saída + raciocínio como são cobrados); se faltarem, estima. É uma **estimativa conservadora**, não a fatura.
- **Erros:** 429/503 → "sobrecarregado/limite" (repete com espera); 500/502/504 e falhas de rede → repete; 400/401/403/404 (chave inválida, modelo inexistente) → **não repete**.
  O usuário vê só mensagens genéricas; o log do servidor registra o código HTTP e a mensagem curta do Google (sem conteúdo do usuário, sem chave).

**Diagnóstico (faz uma chamada pequena e diz se está funcionando):** no console do serviço backend no EasyPanel:
```
python -m app.ai.check
```
Mostra provedor, modelo e `OK` (com tokens) ou o motivo do erro, sem imprimir a chave. Custa uma fração de centavo.

**Verificação:** a integração é coberta por testes com respostas simuladas (`tests/test_gemini.py`: formato do pedido, chave fora da URL/log, status
incompleto, erros HTTP, timeout, tokens e custo). **Chamadas reais ao Gemini não foram executadas pelo desenvolvimento** (não há chave aqui):
rode o diagnóstico acima em produção para confirmar com a sua chave.

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
