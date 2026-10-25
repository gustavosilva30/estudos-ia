# Segurança e autenticação (E2)

## Identidade e sessão
- **Senhas:** Argon2id (`argon2-cffi`, parâmetros padrão da biblioteca), com re-hash automático no login se os parâmetros mudarem. Mínimo de 10 e máximo de 128 caracteres.
- **Sessão:** token aleatório de 256 bits no cookie `estudos_session` (`HttpOnly`, `SameSite=Lax`, `Secure` em produção). O banco guarda apenas o SHA-256 do token (`user_sessions.token_hash`).
- **Expiração:** deslizante (`SESSION_TTL_HOURS`, renovada no máximo a cada 5 min) com teto absoluto (`SESSION_ABSOLUTE_DAYS`). Logout apaga a sessão no servidor.
- **Identidade só pela sessão:** `app/core/deps.py::current_auth` é a única fonte do usuário. Nenhum endpoint aceita `user_id` do cliente; campos extras no corpo são ignorados.
- **Níveis de acesso:** `users.role` (`user`/`admin`) e `require_role("admin")` já disponíveis para uso futuro.

## CSRF
1. Cookie `SameSite=Lax`.
2. Métodos `POST/PUT/PATCH/DELETE` autenticados exigem o cabeçalho `X-CSRF-Token` igual ao token da sessão (comparação em tempo constante). O token vem em `csrf_token` nas respostas de login, cadastro e `GET /api/v1/users/me`.
3. Requisições que alteram dados com cabeçalho `Origin` fora de `ALLOWED_ORIGINS` são recusadas (403), inclusive login e cadastro.

## Proteções contra abuso
- **Login:** limites por e-mail+IP (5), por e-mail (20) e por IP (30) a cada 15 min → HTTP 429 com `Retry-After`. A chave e-mail+IP é a mais estrita para que um atacante não consiga bloquear o dono da conta de outro IP.
- Mensagem e tempo de resposta equivalentes para e-mail inexistente, senha errada e conta inativa.
- **Recuperação de senha:** resposta sempre igual (202), limite por IP e por e-mail, token de uso único com hash e expiração (`PASSWORD_RESET_TTL_MINUTES`). Ao redefinir, todas as sessões são encerradas.
- **Troca de senha:** exige a senha atual e encerra as outras sessões.
- **Exclusão de conta:** exige a senha; apaga todos os dados do usuário por cascata no banco.
- Limite de corpo (`MAX_BODY_BYTES`), cabeçalhos `nosniff`, `X-Frame-Options: DENY`, `Cache-Control: no-store`, `X-Request-ID` em toda resposta.
- Erros inesperados devolvem mensagem genérica com o `request_id`; a pilha vai só para o log, sem corpo da requisição nem segredos.
- `/api/docs` e `/api/openapi.json` existem apenas fora de produção.

## Limitações conhecidas (decisões conscientes)
- **Rate limit em memória** — correto para 1 worker (configuração prevista). Com mais processos, mover o contador para o PostgreSQL.
- **Cadastro com e-mail já usado devolve 409**, o que permite descobrir se um e-mail existe. Como não há verificação de e-mail (sem SMTP), o cadastro pode ser desligado (`REGISTRATION_ENABLED=false`) e fica limitado por IP.
- **Sem SMTP:** a recuperação de senha só funciona em desenvolvimento (link no log). Em produção nada é enviado até configurar um SMTP — sem token em log.
- Atrás do proxy do EasyPanel, o IP visto é o do proxy, a menos que o uvicorn rode com `--proxy-headers --forwarded-allow-ips` do proxy. Ajustar na E7 antes do deploy.
- Rotação do `SECRET_KEY`: ainda não é usado para assinar nada (tokens são aleatórios e verificados no banco).

## Endpoints
| Método | Rota | Auth |
|---|---|---|
| POST | `/api/v1/auth/register` | pública (se habilitada) |
| POST | `/api/v1/auth/login` | pública |
| POST | `/api/v1/auth/logout` | sessão + CSRF |
| POST | `/api/v1/auth/password-reset/request` | pública |
| POST | `/api/v1/auth/password-reset/confirm` | pública (token) |
| GET/PATCH | `/api/v1/users/me` | sessão (+ CSRF no PATCH) |
| PATCH | `/api/v1/users/me/preferences` | sessão + CSRF |
| POST | `/api/v1/users/me/password` | sessão + CSRF |
| DELETE | `/api/v1/users/me` | sessão + CSRF + senha |

## Testes
`backend/tests/test_auth.py` cobre cadastro (flag, duplicidade, validação), login (mensagens iguais, limite, conta inativa), cookie protegido, CSRF, origem externa, logout, expiração, token não armazenado em texto puro, papéis, preferências, identidade só pela sessão, troca e recuperação de senha e exclusão de conta. Os testes de isolamento dos materiais (usuário A × B) estão em `test_library.py` (ver [api-biblioteca.md](api-biblioteca.md)).
