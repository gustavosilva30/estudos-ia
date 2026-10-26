# Roadmap

| Etapa | Escopo | Status |
|---|---|---|
| E0 | Esqueleto, health, testes, compose dev, `.env.example`, docs base | concluída |
| E1 | Modelos e migrations do núcleo + documentação do banco | concluída |
| E2 | Autenticação, CSRF, rate limit (isolamento dos materiais é testado na E3) | concluída — ver [seguranca.md](seguranca.md) |
| E3 | CRUD de matérias, pastas, aulas, textos, notas; busca e paginação | concluída — ver [api-biblioteca.md](api-biblioteca.md) |
| E4 | Camada de IA e operações do MVP, custos, FakeProvider (+ resumos com versões no backend) | concluída — ver [ia.md](ia.md) |
| E5 | Frontend base, tema, telas de autenticação, dashboard com dados reais | concluída — ver [frontend.md](frontend.md) |
| E6 | Biblioteca, editor de resultados, versões, pesquisa global | concluída — ver [frontend.md](frontend.md) |
| E7 | Endurecimento, deploy EasyPanel, backup/restauração | pendente |
| E8d | Biblioteca de fórmulas com resolvedor passo a passo (sem IA) | concluída — ver [frontend.md](frontend.md) |
| E8c | Calculadora científica sem IA (com gráfico) | concluída — ver [frontend.md](frontend.md) |
| E8b | Documentos (PDF) e links lidos pela IA | concluída: testes com banco (backend e frontend); falta conferir no site com um PDF/link reais; ver [ia.md](ia.md) |
| E8 | Imagens (print/foto), imagem→texto (OCR), resolver problemas e IA por categoria de matéria | concluída e verificada (testes com banco e navegador) — falta só uma chamada real do Gemini com imagem; ver [ia.md](ia.md) |

Fase 3 (aprendizado) e Fase 4 (expansão) conforme o plano aprovado. Fase 5: apenas `futuro-android.md`.

## Decisões
- Backend com 1 worker e sem Redis/filas até haver necessidade real.
- Frontend e API no mesmo domínio (`/api`), para cookies de sessão `HttpOnly` sem CORS.
- Conexões locais usam `127.0.0.1`, não `localhost`: no Windows, `localhost` tenta IPv6 primeiro e cada conexão leva ~20 s.
- Cadastro aberto com flag para desligar (E2); IA começa só com `FakeProvider` (E4); SMTP indisponível: e-mails de recuperação vão para o log em desenvolvimento.
- Imagem do backend em Python 3.12; local funciona com 3.11+.
