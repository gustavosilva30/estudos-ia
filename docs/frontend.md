# Frontend (E5)

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4. Tudo em português do Brasil.
> O `frontend/AGENTS.md` (gerado pelo Next) avisa que esta versão tem mudanças em relação ao que se conhece:
> leia `frontend/node_modules/next/dist/docs/` antes de usar APIs do framework. Exemplos desta base: `middleware` virou
> **`proxy.ts`**, e com `cacheComponents` o que usa `useSearchParams`/dados dinâmicos precisa estar dentro de `<Suspense>`.

## Estrutura (`frontend/src`)
| Pasta | Conteúdo |
|---|---|
| `app/(auth)/` | `/entrar`, `/cadastro`, `/recuperar-senha`, `/redefinir-senha` |
| `app/(app)/` | Área logada (layout com menu): `/dashboard`, `/materias`, `/materias/[id]`, `/biblioteca`, `/aulas/nova`, `/aulas/[id]`, `/resumos/[id]`, `/busca` |
| `app/proxy.ts` (`src/proxy.ts`) | Redirecionamento **otimista**: sem cookie de sessão → `/entrar?proximo=…`. Não é segurança; o backend valida cada requisição |
| `components/ui/` | Componentes reutilizáveis: `Button`, `Field`, `PasswordField`, `Alert`, `Card`, `Spinner`, `Skeleton`, `ConfirmDialog` (confirmação de exclusões), ícones |
| `components/` | `app-shell` (menu lateral / barra superior + navegação inferior), `theme-toggle`, `dashboard/`, `auth/` |
| `lib/api.ts` | Cliente da API: mesmo domínio, cookie de sessão, cabeçalho CSRF em métodos que alteram dados, mensagens de erro em português (sem expor detalhes de erros 5xx) |
| `lib/session.tsx` | Estado de sessão (`loading`/`anon`/`authed`/`error`), login, cadastro, logout |
| `lib/theme.tsx` | Tema claro/escuro/sistema; script inline evita "piscar"; salvo no navegador e na conta |

## Como funciona a autenticação na interface
- O cookie `estudos_session` é `HttpOnly`: o JavaScript não o lê. O token CSRF vem do backend e fica **só em memória**.
- Ao abrir o app, `GET /users/me` descobre se há sessão. Sessão expirada em qualquer tela → volta ao login com `?proximo=` (validado por `safeNext`: só caminhos internos). Sair de propósito leva ao login limpo.
- Os dados privados são sempre buscados no navegador, com o cookie; nenhuma página estática contém dados de usuário.

## Dashboard
`GET /api/v1/dashboard` (backend, `services/dashboard.py`) devolve só dados reais do banco, filtrados pelo usuário:
contagens (matérias não arquivadas, aulas, resumos, favoritos), progresso (**aulas com resumo ÷ total de aulas**; também quantas têm texto salvo),
últimas 5 aulas e 5 resumos (salvar/editar um resumo conta como "estudar" a aula) e uso de IA do dia.
**Revisões pendentes:** o módulo de revisão é da Fase 3; o painel mostra um aviso, não um número inventado.

## Telas da biblioteca (E6)
| Rota | O que faz |
|---|---|
| `/materias` | Lista de matérias (cor, nº de aulas, arquivadas); criar matéria |
| `/materias/[id]` | Editar, arquivar, excluir (com confirmação); árvore de **pastas** (criar, renomear/mover, excluir sem perder conteúdo); aulas da matéria/pasta, paginadas |
| `/biblioteca` | Abas **Aulas** e **Resumos**: pesquisa (debounce), filtro por matéria/tipo/favoritos, ordenação, paginação, favoritar na lista |
| `/aulas/nova` | Título, matéria, pasta, data, observações e texto (digitado ou colado, com contador). Salva o texto original **antes** de qualquer uso de IA |
| `/aulas/[id]` | Abas: **Texto original** (editar/adicionar/excluir; nunca alterado pela IA), **Anotações**, **IA** (escolher operação e nível, gerar, ver, salvar como resumo), **Resumos** da aula |
| `/resumos/[id]` | **Editor**: título, Markdown com barra de formatação (título, subtítulo, destacar conceito, itálico, listas, citação), pré-visualização, "Salvar nova versão" (Ctrl+S), aviso de alterações não salvas, histórico de versões (ver / restaurar), favoritar, duplicar, **exportar TXT**, excluir |
| `/busca` | **Pesquisa global** (matérias, aulas por título/texto, resumos com trecho destacado); também há uma caixa de pesquisa rápida no menu lateral |

**Resultados da IA com o provedor de teste:** quando `provider = fake`, a tela mostra o aviso *"Resultado de demonstração"* — o texto é só uma
montagem automática de trechos do material, não um resumo real.
**Markdown seguro:** o conteúdo é renderizado com `react-markdown` (HTML bruto vira texto; `javascript:` é neutralizado; links externos com
`rel="noopener noreferrer nofollow"`). Verificado manualmente no navegador. Negrito aparece como "conceito destacado".
**Exportação:** TXT (Markdown em texto) é gerado no navegador. **PDF não está implementado** (botão desativado "em breve").

## Navegação e responsividade
- Desktop (≥1024px): menu lateral fixo com pesquisa rápida. Celular/tablet: barra superior + navegação inferior (5 itens).
- **Revisão** continua "Em breve" (Fase 3).
- Rotas dinâmicas (`[id]`) seguem o padrão do Next 16 com `cacheComponents`: `params` (promise) dentro de `<Suspense>`; o menu também fica em `<Suspense>`
  (usa `usePathname`). As páginas da área logada declaram `export const instant = false` porque dependem da sessão (carregada no navegador).

## Imagens, problemas e fórmulas (E8)
- **Matéria:** o formulário tem **Área de conhecimento** (Matemática, Física...). A área aparece como etiqueta nas listas e ajusta a IA (ver [ia.md](ia.md)).
- **Aba "Imagens (n)" da aula** (`components/lesson/images-panel.tsx`): enviar arquivo, **colar print (Ctrl+V)**, arrastar e soltar, ou **tirar foto** no celular.
  Valida tipo/tamanho antes de enviar (HEIC não é aceito). Cada imagem tem **Extrair texto** e **Resolver problema** (com nível de detalhe), exibe o resultado abaixo e permite excluir (com confirmação).
- **Imagem → texto:** a transcrição fica numa caixa **editável** (com pré-visualização das fórmulas); só ao clicar em *Salvar como texto original da aula* ela vira texto da aula (origem `image`).
- **Resolver problema:** mostra enunciado, passo a passo, resposta e verificação, com o aviso de que a IA pode errar; pode ser lida em voz alta e salva como resumo editável.
- **Fórmulas:** `components/markdown.tsx` usa `remark-math` + KaTeX (`trust: false`: sem links, imagens nem comandos perigosos); CSS em `katex/dist/katex.min.css`.
- **Testes:** `images-panel.test.tsx` (envio multipart com CSRF, validações, colar/arrastar, extrair/resolver/salvar, excluir), `markdown.test.tsx` (KaTeX e segurança), `math.test.ts`.

## Leitura em voz alta
Botão **Ouvir / Pausar / Continuar / Parar** (`components/read-aloud.tsx`) no editor de resumos (lê o conteúdo atual, inclusive
alterações ainda não salvas, e o título), em cada **texto original** da aula e no **resultado da IA**.
- **Como funciona:** usa o sintetizador do navegador (`speechSynthesis`): sem custo, sem backend, nada vai para o nosso servidor.
  Algumas vozes do Chrome (as "Google") são processadas online pelo Google; as vozes locais do sistema, não.
- **Preparação do texto** (`lib/speech.ts`): resumos e resultados da IA têm a marcação Markdown removida (não fala "asterisco" nem
  "jogo da velha"; títulos e itens de lista ganham pausa; código em bloco e HTML são ignorados). O texto original do usuário é lido
  como foi digitado (só junta quebras de linha dentro do parágrafo). Textos longos são divididos em trechos de até ~220 caracteres:
  o Chrome interrompe falas muito longas.
- **Opções (ficam salvas neste navegador):** velocidade (0,75× a 1,75×) e voz (somente vozes em português, pt-BR primeiro).
- **Comportamento:** só uma leitura por vez; sair da tela cancela a leitura; mostra "trecho X de Y"; mensagens claras de erro.
- **Limitações:** a qualidade e as vozes disponíveis dependem do aparelho/navegador (sem voz em português instalada, o app avisa);
  não há marcação do trecho lido na tela nem retomada de onde parou depois de fechar a página. Possível evolução (não implementada):
  voz neural gerada por API, com áudio em cache.
- **Testes:** `lib/speech.test.ts` (limpeza e divisão do texto) e `components/read-aloud.test.tsx` (componente com sintetizador simulado:
  ouvir/pausar/continuar/parar, velocidade e voz, uma leitura por vez, cancelamento ao sair, erros). A qualidade real da voz só dá para
  avaliar ouvindo no navegador.

## Acessibilidade e UX
Link "Pular para o conteúdo", rótulos em todos os campos, `aria-invalid`/`aria-describedby` nos erros, `role="alert"/"status"`,
`aria-current` no menu, barra de progresso com `role="progressbar"`, foco visível, `prefers-reduced-motion`, esqueletos de carregamento,
confirmação em `<dialog>` nativo (componente pronto para as exclusões da E6).

## Rodar e testar
```bash
cd frontend
npm install
npm run dev        # http://localhost:3000 (precisa do backend em 127.0.0.1:8000)
npm run lint && npx tsc --noEmit
npm test           # Vitest: cliente da API, redirecionamento seguro, datas, leitura em voz alta
npm run build
```
`BACKEND_INTERNAL_URL` (padrão `http://127.0.0.1:8000`) define para onde o Next encaminha `/api/*`. **Atenção:** é lido no *build*;
em produção o ideal é o proxy do EasyPanel rotear `/api` direto ao backend (ver `docs/roadmap.md`, E7).
Use `127.0.0.1` e não `localhost` (no Windows, `localhost` tenta IPv6 primeiro e atrasa cada conexão).

## Verificado manualmente no navegador (E5)
Redirecionamento do proxy para o login; validação inline do cadastro; cadastro → painel; painel com dados reais
(matérias, aulas, resumo, favorito, progresso 33%); tema claro/escuro persistido na conta e após recarregar; layout de celular
(375×812) com navegação inferior; logout limpa o cookie; erro de login em português; login retorna ao destino pedido.
**E6 (navegador, desktop e celular):** criar matéria e pasta, criar aula com texto, gerar resultado de IA (aviso de demonstração), salvar como resumo,
formatar e salvar nova versão, histórico de versões, pré-visualização, teste de conteúdo malicioso no Markdown, pesquisa global com termo destacado,
biblioteca, confirmação de exclusão e editor no celular.
Ainda **não** há testes automatizados de interface (Playwright) — previsto para a E7.


## Calculadora (`/calculadora`)

Calculadora científica **sem IA**, 100% no navegador (nada vai ao servidor, não gasta cota). Código em `src/lib/calculator.ts` (motor) e `src/components/calculator/`.

- **O que faz:** expressões completas com precedência correta, parênteses, `%`, `mod`, fatorial, potências e raízes, `ln`/`log`/`log2`/`exp`, trigonometria (graus ou radianos, com inversas e hiperbólicas), combinatória, estatística básica,
  variáveis (`x = 3`), funções do usuário (`f(t) = t^2 - 4`), `ans`, memória (MC/MR/M+/M-), números complexos, matrizes (produto, determinante, inversa, transposta), frações, conversão de unidades (`5 km to m`),
  histórico (últimos 50, no `localStorage`) e **gráfico de funções** de x.
- **Entrada em português:** `×`, `÷`, `−`, `π`, `√`, `²` e vírgula decimal (`2,5`); dentro de funções e matrizes a vírgula continua separando argumentos (`max(1,2)`).
- **Motor:** biblioteca `mathjs` (sem `eval`), carregada só nesta página. **Lista de funções permitidas fechada:** `import`, `createUnit`, `evaluate`, `parse`, `simplify`, `derivative`, `config` e funções que alocam matrizes/intervalos
  gigantes (`ones`, `zeros`, `identity`, `range`, `1:1e9`...) ficam bloqueadas; combinatória é limitada a 10 000; expressão máxima de 500 caracteres; fatorial acima de 170 dá infinito sem calcular.
  Os testes cobrem esses bloqueios e o tempo de resposta de cálculos gigantes.
- **Fora do escopo:** CAS (simplificar/derivar/integrar simbolicamente), resolução de sistemas de equações e gráficos 3D.
