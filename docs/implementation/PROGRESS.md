# Progresso da implementação — Além do SiSU

## Contrato de execução

- `docs/reference/arquitetura_planejamento_editais_graduacao.docx` governa arquitetura, escopo e requisitos.
- `docs/reference/ordem_implementacao_commits_alem_do_sisu_codex.docx` governa sequência, testes e checkpoints. Divergências e escolhas técnicas em aberto exigem ADR antes de implementação.
- Cada passo deve ser examinado e validado isoladamente. Antes de um commit, registrar ID, seções da arquitetura consultadas, estado do repositório, escopo, comandos e resultados. Usar Conventional Commits somente com validação verde e repositório Git apto.
- Não fazer push, deploy ou migração em produção sem autorização explícita. Não publicar editais, links ou dados sem fonte oficial e revisão humana.
- Gates G0–G5 controlam o MVP P0; G6 controla P1; G7 controla P2. Nenhuma fase posterior está aprovada por antecipação.
- A imagem `style-reference.png` na raiz é a referência estética para as etapas de interface, preservadas as regras de acessibilidade e de dados verificáveis.

## Estado atual

| Campo                   | Valor |
| ----------------------- | ----- |
| Fase                    | F08 — catálogo público / avaliação P0 |
| Passo                   | 084 — avaliação da release 1.0, RETIDA |
| Estado                  | Checkpoints 080–084 reavaliados; somente staging local e evidências documentais acrescentados |
| Data                    | 2026-11-11 (America/Sao_Paulo) |
| Arquitetura consultada  | Passos 080–084: §§ 4.1–5.2, 10.1–12.2 conforme checkpoint |
| Roteiro consultado      | Passos 080–084; F08/P0, gates G5 preservados |
| Commit backend          | `9eb6a02` antes desta avaliação; local, sem push |
| Commit frontend         | `73a98a8`; local, sem push |
| Repositórios            | Git independentes; backend e frontend com commits locais não enviados |
| Gate                    | G5 PENDENTE: pipeline de negócio não integrado, fontes desativadas, sem staging externo/domínio, curadoria ou autorização de publicação |
| Próximo passo           | Resolver pendências externas e do pipeline integrado antes de reconsiderar publicação |

## Passo 073 - evidencias

- Estado antes da implementacao: frontend limpo em `1a1b80b` e backend limpo em `48a23c6`; repositorios Git independentes. O frontend foi commitado localmente como `127fd89` (`feat(web): criar diretorio de instituicoes e filtros`); o commit backend foi `80f8e70` (`feat(api): filtrar diretorio de instituicoes`). Nenhum push.
- Arquitetura consultada: secoes 8, 9.1, 9.3 e 9.4. Roteiro consultado: checkpoint 073, F08/P0. O diretorio publica apenas instituicoes verificadas, mostra cobertura vinda da API e avisa que monitoramento nao garante completude.
- ADR 0040 aceito pelo usuario: filtros server-side `q`, `uf`, `city` e `jurisdiction` antes da paginacao; `q` pesquisa nome/sigla, geografia usa apenas campi verificados. O mesmo contrato alimenta OpenAPI e cliente Angular gerado.
- Backend: parser de filtros validado; consulta e contagem compartilham o mesmo predicado; filtro geografico tambem restringe os campi retornados. Testes unitarios 182/182; integracao `public-institutions` 1/1 em PostgreSQL descartavel local, com migrations e seed oficial; lint, typecheck, `openapi:check`, format e `git diff --check`: PASS. O servidor PostgreSQL temporario foi encerrado. A remocao dos arquivos temporarios foi bloqueada pelo executor; permanecem fora dos repositorios e sem servico ativo.
- Frontend: rota `/instituicoes`, filtros com query string, debounce, paginacao/reset e navegacao voltar/avancar; sem instituicoes ou cobertura inventadas. Testes 44/44; E2E 1/1; lint, typecheck, build (sem avisos), format e `git diff --check`: PASS. `api:generate` executado a partir do OpenAPI e o contrato sincronizado.
- Passo concluido localmente nos dois repositorios. Proximo: passo 074, spike SSR/SEO; sem push, deploy ou migracao de producao.

## Passo 074 - evidencias e pendencias

- Estado antes do passo: frontend limpo em `127fd89`; backend limpo em `80f8e70`. Repositorios Git separados. Frontend commitado localmente como `4c383ea` (`feat(web): adicionar metadados SEO por rota`); este commit registra ADR e progresso. Nenhum push.
- Arquitetura consultada: secao 9.1, regras da 9.3 e recomendacao ADR-005. Roteiro 074 relido. A arquitetura sugere SSR em detalhes e SSR/SSG no diretorio, mas recomenda avaliar renderizacao hibrida antes da decisao.
- O usuario decidiu manter CSR ate escolher hosting e dominio. ADR 0041 registra o aceite, a falta atual de hosting/dominio/API publica, as consequencias e pendencias. O nome `0004-rendering` do roteiro conflita com ADR 0004 (segredos); o documento foi numerado 0041 para nao sobrescrever historico.
- Implementado no frontend: title e description por rota, Open Graph, `noindex` em area administrativa e detalhes indisponiveis; detalhe publicado recebe metadata dinamica somente apos resposta publica da API. Canonical e emitido apenas com `publicSiteUrl` HTTPS configurado, sem query string. URL oficial ainda nao configurada; nenhum canonical de producao e emitido.
- Sitemap nao criado: nao ha dominio oficial nem mecanismo de build que liste somente detalhes publicados. Manter vazio evita inventar URLs. O crawler sem JavaScript recebe o shell CSR; metadados dinamicos para crawlers permanecem pendentes de SSR/SSG/prerender apos escolha do provedor.
- Validacao frontend: 47/47 testes unitarios (10 arquivos), E2E de shell e rotas 1/1, lint, typecheck, build sem avisos, format e `git diff --check`: PASS. Uma primeira execucao encontrou import incorreto de `Title` e tipagem do DOM; corrigido antes do commit e todos os checks reexecutados.
- Estado: codigo e decisao provisoria concluidos no escopo aprovado; pendentes comparacao CSR vs SSR/SSG no provedor real, dominio oficial, canonicals ativos e sitemap de processos publicados. Proximo passo sequencial: 075, E2E/A11y/responsividade.

## Passo 075 - evidencias e pendencias

- Estado antes do passo: frontend limpo em `4c383ea`; backend limpo em `5b0155e`. Repositorios Git independentes. Frontend commitado localmente como `f582494` (`test(web): cobrir jornadas publicas e acessibilidade`); este commit registra o progresso no backend. Nenhum push.
- Arquitetura consultada: regras de interacao das secoes 9.3/9.4 e alvo WCAG 2.2 AA. Roteiro 075 relido; escopo limitado a testes publicos, acessibilidade e responsividade.
- Playwright + axe: quatro jornadas em Chromium com API mockada e dominios reservados `.example`: filtros/URL/historico e vazio; detalhe publico, saida segura em nova aba e 404; menu mobile/teclado/foco; auditoria axe em home, listagem, vazio, detalhe, 404, diretorio e menu aberto. Axe encontrou zero violacoes WCAG 2.2 A/AA nos estados cobertos.
- Responsividade: sem overflow horizontal em 320, 390 e 768 px. Ajustado o grafismo da home e dimensoes de titulo/CTA. Corrigido nome acessivel duplicado da marca. Navegacao testou link de pulo, ordem de Tab, abertura com Enter e foco restaurado no botao ao fechar o menu.
- Validacao final: testes unitarios 47/47 (10 arquivos); Playwright 4/4; axe 0 violacoes; lint, typecheck, build sem avisos, `format:check`, `install --frozen-lockfile` e `git diff --check`: PASS. Os testes nao acessam links oficiais reais nem dados de producao.
- Pendente: validar anuncios e ordem de leitura com leitor de tela real (NVDA, Narrator ou VoiceOver). O host de automacao de UI/browser nao estava disponivel; o relatorio `frontend/docs/quality/a11y.md` declara esse limite e nao afirma conformidade integral.
- Proximo passo sequencial: 076, testes de confiabilidade do frontend. Nenhum deploy/publicacao.

## Passo 001 — evidências

- Artefatos: os dois documentos originais foram copiados sem alteração para `docs/reference/`.
- Verificação executada: comparação byte a byte entre original e cópia, `ZipFile.testzip()` sem erro e parse de `word/document.xml` sem erro para ambos os documentos. `PROGRESS.md` existe e contém o ID 001. Resultado: todos os checks do passo passaram.
- SHA-256 da arquitetura (original e cópia): `619f871396a1cbf64672a4cddb7e0f8e6bacafc991bca5ec227efb91de3f6fbc` (175012 bytes).
- SHA-256 do roteiro (original e cópia): `d46cc856e7bbf2949d5953ec384eb337377187f86eb8979701ef485e73fb7fd5` (65792 bytes).
- Comandos: script Python local com `Path.read_bytes`, `ZipFile.testzip`, `ElementTree.fromstring` e SHA-256; `git rev-parse --show-toplevel` antes dos checkouts (confirmou ausência de Git); `git clone` dos dois repositórios vazios para as pastas locais correspondentes. Revalidar as cópias dentro do backend antes do commit.
- Testes de código, lint, typecheck e build: não se aplicam ao passo documental 001; os scripts serão criados no passo 011.
- Estado remoto observado: `oeduardodev/PROJETO-Ads-frontend` e `oeduardodev/PROJETO-Ads-backend` existem, mas estão vazios. Os checkouts locais foram criados. Nenhum push foi feito.

## Passo 002 — evidências

- Artefatos: `docs/adr/0000-repository-topology.md`, `docs/adr/0001-scope.md` e `docs/adr/0002-system-design.md`.
- Decisão de topologia: usuário escolheu dois repositórios Git separados; ADR 0000 registra como manter documentação, contratos e commits.
- Casos de escopo: ADR 0001 lista cenários positivos, negativos e incertos a transformar em testes nas etapas de domínio e ingestão.
- Decisões técnicas abertas: ORM, autenticação administrativa e renderização híbrida permanecem pendentes de spike/ADR nos respectivos passos.
- Validação prescrita executada: conferência estrutural dos três ADRs, 4 casos positivos, 6 negativos e 2 incertos; invariantes de escopo e componentes presentes; referência ao SHA do passo 001 no progresso; `git diff --check` e `git diff --cached --check` sem erros. Resultado: verde.
- Lint, typecheck, teste e build de código: ainda não existem scripts; o passo 011 os criará. Não se aplicam ao passo documental 002.

## Passo 003 — evidências

- Artefatos: `docs/research/source-matrix.csv` e `docs/research/crawl-policy.md`.
- Pesquisa em páginas institucionais oficiais: UFPB/PRG, UFCG/COMPROV, UEPB/PROGRAD e IFPB/Portal do Estudante. As quatro listagens responderam HTTP 200 em acesso HTTPS direto em 2026-11-02; contatos e critérios de filtragem estão documentados.
- `robots.txt`: UFPB/PRG 404, UFCG/COMPROV 200 com bloqueios de caminhos internos, UEPB 403, IFPB/Portal do Estudante 404. Esses resultados não autorizam coleta automática; UEPB fica em pesquisa manual até esclarecimento. A política registra a licença exibida pela COMPROV e pendências de termos/retenção.
- Comandos e resultados: pesquisa Web em domínios institucionais; requisições HTTPS diretas com `urllib.request` para as quatro páginas e `robots.txt`; validação CSV com 4 linhas, uma por instituição, campos completos, URLs HTTPS, host exato, status 200 e links presentes na política: PASS. `git diff --check`: PASS.
- Testes de código, lint, typecheck e build: não se aplicam ao passo de pesquisa; scripts ainda não existem.

## Passo 004 — evidências

- Estado real antes do passo: backend no commit `5b04ed0`, com árvore limpa; frontend é repositório Git separado e ainda vazio. Nenhuma dependência instalada ou serviço em execução.
- Artefatos: `test/fixtures/institutions/candidate-manifest.csv` (48 URLs oficiais, 35 promovidas e 13 candidatas), `docs/research/golden-dataset.csv` (35 documentos históricos de UFPB 15, UFCG 5, UEPB 5 e IFPB 10), notas de curadoria e validador Python. Há HTML, PDFs de editais, retificações e negativos; páginas e PDFs do mesmo processo são artefatos distintos, não processos adicionais.
- Gabarito: campos de escopo, tipo, SiSU, ENEM, prazo, fuso, vínculo de revisão, fonte oficial, seção/página e data de conferência. `UNKNOWN` preserva ausências; oito artefatos têm revisão parcial e três seleções de vagas remanescentes estão em `PENDING_REVIEW` pelo ADR 0003 aceito pelo usuário. Nada foi publicado.
- Casos verificados: ENEM exigido (UFPB-13, IFPB-15), dispensado (UFPB-09), prazo sem horário final (UFCG-03), duplicata HTML/PDF (UFPB-02/09), fora do escopo (UFPB-05), retificação de prazo (IFPB-15/16: 27/07 para 20/07/2026) e retificação de requisito ENEM (UFPB-15/16). PDFs continuam somente nos portais oficiais; nenhuma lista nominal foi incorporada.
- Validação prescrita: `python test/fixtures/institutions/validate_golden_dataset.py` confirma 35 documentos, quatro instituições, URLs oficiais, datas válidas, histórico no momento da revisão, seis tipos de caso, pares de revisão e estados consistentes. Resultado: PASS. `git diff --cached --check`: executar após staging. Lint, typecheck, teste de aplicação e build ainda não existem; o passo 011 criará esses scripts.
- Pendências: manter os três casos de vagas remanescentes em revisão humana; manter campos `UNKNOWN` e divergências documentais sem inferência; obter confirmação de licenças/retenção antes de armazenamento ou coleta automática. G0 ainda não aprovado; depende do passo 005 e da revisão do checkpoint.

## Passo 005 — evidências e checkpoint G0

- Estado real antes do passo: backend no commit `abc9b2c`, árvore limpa; frontend em `main` sem commit. Nenhuma dependência, pipeline, API ou UI ainda existe.
- Artefatos: `docs/domain/glossary.md`, `docs/domain/state-machine.md` e `docs/quality/metrics.md`. O gabarito do IFPB-13/14/15/16 recebeu `ENEM_OWN_SELECTION` porque o edital 112/2026 comprova seleção institucional por nota do ENEM; nenhum prazo ou URL foi alterado neste passo.
- Taxonomia: 12 tipos do corpus, escopo trivalente e independência entre SiSU e ENEM; estados de ingestão, publicação e inscrição separados. Casos `UNKNOWN` e `PENDING_REVIEW` não podem virar fatos públicos. Metas de 95% de precisão do piloto, 100% de URL oficial, p95 < 500 ms e WCAG 2.2 AA são objetivos, não medições atuais.
- Métrica inicial calculada no corpus: 35 artefatos, 4 instituições, 29 `IN_SCOPE`, 3 `OUT_OF_SCOPE`, 3 `PENDING_REVIEW`; `requires_enem` conhecido em 27/35 e horário final em 23/35. Precisão do extrator, recall de descoberta, custo e latência permanecem `NOT_MEASURED` até haver componentes para executar.
- Validação prescrita: compatibilidade de todos os 12 códigos `selection_type` do CSV com o glossário; presença dos estados conceituais; contagens e rótulos de métricas; `python test/fixtures/institutions/validate_golden_dataset.py`; verificação de quatro linhas da matriz e ADRs 0000–0003 aceitos. Resultado: PASS. `git diff --cached --check`: executar após staging. Lint, typecheck, testes de aplicação e build serão criados no passo 011.
- G0 — Pesquisa aprovada **para iniciar a fundação local**: matriz oficial de quatro instituições revisada, 35 artefatos rotulados, escopo e ADRs 0000–0003 revisados e aceitos, exceções e conflitos preservados. O gate não autoriza coleta automática, publicação de editais, push, deploy ou migração de produção. Os três casos de remanescentes continuam exigindo decisão humana individual.

## Passo 006 — evidências

- Estado real antes do passo: backend limpo em `05b7118`; frontend `main` vazio, com remoto GitHub configurado, sem commits. ADR 0000 determina dois repositórios e documentação canônica no backend.
- Artefatos coordenados: `pnpm-workspace.yaml`, `package.json`, `pnpm-lock.yaml`, `.editorconfig` e `.gitignore` nas duas raízes; `apps/api/package.json` no backend; `apps/web/package.json` no frontend; convenções em `docs/implementation/COMMITS.md` e `frontend/CONTRIBUTING.md`. NestJS/Angular serão criados nos passos 007/008.
- Ambiente: Node v24.15.0, Corepack v0.34.6 e pnpm v12.16.1 fixado por `packageManager`. Como `pnpm` não está globalmente no PATH, `corepack pnpm` executou os comandos prescritos sem alterar o repositório remoto.
- Validação prescrita: `corepack pnpm install` e `corepack pnpm install --frozen-lockfile` passaram em ambos os workspaces, cada um com dois projetos. `git check-ignore .env .env.local node_modules/sample` confirmou exclusão nas duas raízes; não há arquivo `.env` com segredo staged. `git diff --cached --check` no frontend: PASS; no backend: executar antes do commit. Lint, typecheck, testes de aplicação e build entram no passo 011.
- Ordem dos commits deste passo: frontend `ce3440118939535b72543d7adc59e491203246e1` primeiro; backend `HEAD` deste registro segundo. A compatibilidade é pnpm 12.16.1 e workspaces independentes; não há contrato API/Web ainda. Nenhum push.

## Passo 007 — evidências

- Estado real antes do passo: backend limpo em `bcb715f`; frontend limpo em `ce34401`. A arquitetura §§ 3, 7 e 11 requer API modular e worker independente, sem trabalho pesado em request HTTP.
- Artefatos: `apps/api/src/main.ts` inicia REST; `apps/api/src/worker.ts` usa `createApplicationContext` sem servidor HTTP; `apps/api/src/modules/` contém health e módulos de domínio vazios. TypeScript estrito, ESM, NestJS 12.3.2, TypeScript 6.0.3 e dependências fixadas no lockfile. Os módulos vazios não executam coleta, IA ou publicação.
- Validação prescrita: `corepack pnpm install`: PASS; `corepack pnpm --filter @alem-do-sisu/api build`: PASS; API iniciada localmente com `PORT=3107`, `GET http://127.0.0.1:3107/health` → HTTP 200 e `{"status":"ok"}`; `corepack pnpm --filter @alem-do-sisu/api start:worker` → inicialização sem erro e saída 0; conexão TCP a 127.0.0.1:3108 recusada, confirmando ausência de listener do worker. API de teste encerrada. `git diff --cached --check`: executar após staging.
- Limite deste passo: worker ainda não tem jobs e termina após inicialização; a fila entra nos passos de descoberta. Configuração validada, Postgres/Redis, lint e testes automatizados entram nos passos 009–011. Nenhum push ou deploy.

## Passo 008 — evidências

- Estado real antes do passo: frontend limpo em `ce34401`, com workspace vazio; backend limpo em `0a2ee56`. O passo só altera o frontend e este registro canônico de progresso.
- Artefatos: Angular 22.2.4 standalone com roteamento e TypeScript 6.0.3 estrito em `frontend/apps/web`; Tailwind 4.3.3; feature `home`, pastas `core`/`shared`, shell com idioma `pt-BR`, link para pular conteúdo, foco visível, redução de movimento e layout responsivo. SSR/SSG continuam pendentes do ADR no passo 074.
- Referência visual: `style-reference.png` foi inspecionada e amostrada sem alterar a imagem. Tokens em `src/styles.css`: marfim `#fcf5ed`, preto `#050505`, verde `#c1fb01`, laranja `#fe6402`, azul `#3845fd`, lilás `#e389fc`; tipografia sans pesada, bordas e sombras deslocadas. O shell usa parte da linguagem de cartaz; composição completa, busca e cards ficam nos passos 067–068, sem oportunidades fictícias como vigentes.
- Validação prescrita: `corepack pnpm install --frozen-lockfile`: PASS após registrar `allowBuilds` para quatro dependências do scaffold; `corepack pnpm --filter @alem-do-sisu/web build`: PASS (bundle inicial 212,35 kB bruto); `ng serve` em 127.0.0.1:4208: PASS, HTTP 200 com `pt-BR` e título correto, sem backend ativo; servidor de teste encerrado. `git diff --cached --check` no frontend: PASS. O navegador integrado não estava disponível para inspeção visual nesta sessão; revisão visual permanece para as etapas de interface.
- Instalação: a primeira tentativa parou em `ERR_PNPM_IGNORED_BUILDS`; a configuração explícita em `pnpm-workspace.yaml` permitiu `@parcel/watcher`, `esbuild`, `lmdb` e `msgpackr-extract`, e a repetição passou. `pnpm peers check` ainda aponta conflito transitivo entre `@oxc-parser/binding-wasm32-wasi` e `@napi-rs/wasm-runtime` sobre `@emnapi/*`; o build e o servidor funcionam. Não foi aplicado override sem necessidade comprovada.
- Ordem dos commits: frontend `28e5ab7cb07c01855a061f939b81591e3a515658` primeiro; backend `HEAD` deste registro segundo. Nenhum push, deploy ou publicação de edital.

## Passo 009 — evidências

- Estado real antes do passo: backend limpo em `bb963e0`; frontend limpo em `28e5ab7`. A arquitetura §§ 6, 7.2 e 11–11.1 define PostgreSQL como fonte persistente e Redis como infraestrutura de filas; o passo 009 limita-se aos serviços locais.
- Artefatos: `infra/compose.dev.yml` com PostgreSQL 17.7 e Redis 7.4.12 fixados, healthchecks, portas vinculadas a `127.0.0.1`, volumes nomeados e AOF do Redis; `infra/README.md` com uso local e endereços da API/worker. Senha local em `.env` ignorado pelo Git; nenhum segredo entrou no índice.
- Ambiente de teste: Docker Engine 29.1.3 e Compose 2.40.3 instalados no Ubuntu 24.04 do WSL 2, sem Docker Desktop. `docker compose --env-file .env -f infra/compose.dev.yml config --quiet`: PASS; `up -d --wait`: ambos os serviços `healthy`.
- Persistência: criados um marcador SQL e uma chave Redis descartáveis; após `docker compose restart` e `up -d --wait`, ambos retornaram `step009`. Os dois volumes nomeados foram inspecionados, e as portas 5433/6380 responderam via TCP no Windows. Marcadores removidos em seguida. Resultado: PASS.
- `git diff --cached --check`: executar após staging. Nenhuma migration, publicação, operação de produção, push ou deploy. Configuração validada da API/worker e `.env.example` entram no passo 010; scripts gerais de qualidade entram no 011.

## Passo 010 — evidências

- Estado real antes do passo: backend limpo em `b2d992f` e frontend limpo em `28e5ab7`. A arquitetura §§ 7.1–7.2, 10.3 e 11.1 exige segredos fora do bundle e do Git; o roteiro pede falha clara quando falta segredo obrigatório.
- Ambiguidade resolvida por decisão explícita do usuário: chaves de busca/IA só serão exigidas quando seus conectores forem ativados. ADR 0004 registra alternativas e aceite; a ausência dessas chaves não impede o shell atual. `DATABASE_URL` com usuário/senha/banco e `REDIS_URL` são exigidos antes de inicializar API/worker; `CORS_ORIGINS` é exigido pela API.
- Backend: `.env.example` sem credenciais, `apps/api/src/config/environment.ts` com validação e mensagens sem valores de segredo; inicialização da API e worker invoca o validador. `.env` local com senha gerada permaneceu ignorado. `infra/README.md` explica preenchimento local.
- Frontend: `src/environments/` contém apenas `apiBaseUrl`, `publicSiteUrl` e `catalogEnabled` públicos. `angular.json` substitui o arquivo no build de desenvolvimento, e a configuração é registrada em token de injeção. Produção deixa URLs vazias até definição de ambiente, sem chamadas de API pelo shell.
- Validação: build TypeScript do backend PASS; API e worker sem `DATABASE_URL` encerraram com `Configuration error: DATABASE_URL is required`; ausência de `REDIS_URL` e senha no URL do PostgreSQL falharam com mensagens específicas; configuração local válida iniciou API (`GET /health` HTTP 200, CORS restrito à origem configurada) e worker (saída 0, sem listener). Builds Angular de desenvolvimento e produção PASS; URL local apareceu somente no bundle de desenvolvimento; nomes de variáveis privadas, hosts locais e a senha real de teste não apareceram no JavaScript de produção. `git diff --cached --check` no frontend PASS; executar no backend após staging.
- Limites: a validação ainda não conecta ao banco nem ao Redis; readiness de dependências entra no passo 019. Provedores de busca/IA, autenticação, storage e URLs públicas definitivas dependem das etapas correspondentes. Nenhum push, deploy ou migração de produção.

## Passo 011 — evidências

- Estado real antes do passo: backend limpo em `7dca1e3`, frontend limpo em `ed48ebf`; documentação e contratos canônicos permanecem no backend. A arquitetura § 12.1 separa testes unitários, contrato, integração, conectores, IA, E2E e segurança.
- Artefatos nos dois repositórios: `eslint.config.mjs` com ESLint flat config, `.prettierrc.json`, `.prettierignore`, scripts raiz `lint`, `typecheck`, `test`, `build`, `test:e2e`, `format` e `format:check`, dependências fixadas em `package.json`/`pnpm-lock.yaml`. Código existente foi formatado, sem mudança de comportamento intencional.
- Backend: quatro testes unitários do contrato de configuração (segredos obrigatórios, erro sem valor, Redis e CORS) e um teste de execução HTTP de `/health` com CORS. Frontend: Vitest/Angular testa aviso de catálogo em preparação sem links externos fictícios; teste local sobe `ng serve` e confirma HTML em português sem API. Esses testes de execução não substituem a suíte de navegador e os fluxos completos previstos nos passos posteriores.
- Validação prescrita: `corepack pnpm install --frozen-lockfile` PASS em ambos; `format:check`, `lint`, `typecheck`, `test` e `build` PASS em ambos, executados nessa ordem após formatação. Backend: 4/4 unitários e 1/1 HTTP; frontend: 1/1 unitário e 1/1 inicialização local. `test:e2e` PASS nos dois como smoke; `git diff --cached --check` no frontend PASS, executar no backend após staging.
- Pendente: ampliar cobertura conforme módulos reais e testar Playwright, acessibilidade, integrações e contratos nas etapas correspondentes. `pnpm peers check` no frontend ainda aponta conflito transitivo `@emnapi/*` já observado no passo 008, sem falha de build ou teste. Nenhum push ou deploy.

## Passo 012 — evidências

- Estado real antes do passo: backend e frontend limpos nos commits `edf7e9f` e `c70ba5a`. O passo foi executado nas branches locais `ci-step-012`, sem push. Arquitetura § 11 prevê CI para lint, typecheck, testes e build, com migrations controladas.
- Artefatos: `.github/workflows/ci.yml` em cada repositório, com permissão somente de leitura, gatilhos PR/`main`/manual, Node 24.15.0, pnpm 12.16.1, cache de pnpm, instalação congelada, formatação, lint, typecheck, testes e build. `docs/engineering/git-workflow.md` documenta PR, revisão, status `quality` e futura proteção de `main` em cada repositório. Não há job de deploy ou migration.
- Validação local: `act --list` reconheceu o job em ambos. `act pull_request --job quality` na branch de teste passou no backend (4 testes unitários, build) e no frontend (1 teste unitário, build). Uma falha temporária de teste em cada repositório tornou o respectivo job vermelho na etapa de testes; as falhas foram removidas e as suítes locais voltaram a passar. `git diff --cached --check` PASS em ambos antes dos commits.
- Limite: a tentativa de salvar cache no `act` em `/mnt/c/Users/Eduardo Batista/...` emitiu aviso porque o caminho contém espaço; o job concluiu verde. Isso não comprova o cache no runner hospedado. Os repositórios GitHub continuam vazios porque o usuário proibiu push; portanto, PR hospedado, status remoto e ruleset de branch não foram executados nem marcados como concluídos. A política descreve como verificar isso após autorização futura de publicação.
- Passo 011 revalidado em checkouts Git limpos, após os commits, com `pnpm install --frozen-lockfile`, lint, typecheck, teste e build verdes em ambos. Nenhum push, deploy ou migration de produção.

## Passo 013 — evidências

- Estado real antes do passo: backend limpo em `9b12856`, frontend limpo em `5e8b563`; repositórios Git separados e remotos vazios por proibição explícita de push. A arquitetura §§ 3, 7, 9 e 11–11.1 define processos, serviços e parâmetros documentados.
- Artefatos: `README.md` na raiz de cada repositório e `docs/engineering/local-development.md` em ambos. O README do backend dá pré-requisitos, `.env` local sem sobrescrever arquivo existente, instalação congelada, portas, sequência Compose/API/worker/web, URLs, testes e parada/reset apenas local. O frontend documenta execução sem API e limites do shell. `.gitattributes` fixa LF nos dois repositórios após problema real de CRLF no Windows; Angular CLI teve telemetria opcional desativada para não interromper o primeiro `ng serve`.
- Reprodução local seguindo os comandos do README: Compose `up -d --wait` trouxe PostgreSQL e Redis `healthy`; `node --env-file=.env apps/api/dist/main.js` respondeu `GET /health` HTTP 200 com `{"status":"ok"}`; worker iniciou e encerrou com saída 0; `ng serve --host 127.0.0.1 --port 4200` respondeu HTTP 200. Processos de teste Node/Angular foram encerrados. Links internos dos READMEs e comandos citados foram conferidos.
- Após ajuste de fim de linha, `format:check`, lint, typecheck, testes e build passaram nos dois repositórios; `git diff --cached --check` no frontend PASS, executar no backend após staging. A primeira checagem de formatação após `git restore` identificou CRLF em um teste por repositório; os arquivos foram normalizados e a causa foi tratada com `.gitattributes`.
- Limite: um desenvolvedor com cópias locais consegue seguir o guia; clonar os remotos vazios ainda não reproduz o código até que uma publicação seja explicitamente autorizada. O worker não executa jobs e a API não testa dependências no readiness ainda. Nenhum push, deploy ou migration de produção.

## Passo 014 — evidências

- Estado real antes do passo: backend em `38dca8c` com apenas o rascunho não rastreado do ADR 0005; frontend limpo em `b426b7f`. A arquitetura §§ 1, 5, 6 e 7.1 e o roteiro 014 foram relidos antes da mudança. O usuário escolheu explicitamente Prisma 7.10.1 após spike comparativo com TypeORM; ADR 0005 aceito.
- Artefatos: Prisma CLI/client/adapter PostgreSQL 7.10.1 fixados no lockfile; `schema.prisma` sem entidades de domínio, `prisma.config.ts`, migration gerada `20261103015429_baseline`, `DatabaseModule` global e `PrismaService` com client Nest sob demanda e desconexão no ciclo de vida. API e worker recebem o módulo, sem executar migration no boot. O client gerado é ignorado pelo Git e regenerado no build/typecheck. Política de backup, restauração e migration compensatória em `docs/engineering/migrations.md`.
- Validação prescrita: `prisma validate` e `prisma generate` PASS; em PostgreSQL 17.7 local, `db:migrate:deploy` aplicou a única baseline no banco **vazio** `alem_do_sisu_step014_verify`; `db:migrate:status` informou schema atualizado, e `_prisma_migrations` registrou `20261103015429_baseline|t`. A migration vazia é intencional: tabelas `institutions`/`campuses` pertencem ao passo 015. A primeira tentativa detectou uma baseline duplicada produzida pelo comando `--create-only`; a cópia manual foi removida e o teste foi repetido em outro banco vazio até passar.
- Qualidade após correção: `corepack pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test`, `test:e2e` e `build` PASS; 4 testes de configuração e 1 smoke HTTP verdes. Worker com `.env` local inicializou e encerrou com código 0. `git diff --check` PASS; `git diff --cached --check` será executado após staging. Nenhum dado de edital foi criado ou publicado.
- Pendências: tabelas e seed no passo 015, readiness das dependências no passo 019; G1 só no fim do passo 029. Nenhum push, deploy ou migration de produção.

## Passo 015 — evidências

- Estado real antes do passo: backend limpo em `4553743f276e2b1c5d7c55b5872a4debb168e645`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidas arquitetura §§ 1, 5, 6 e 7 e instruções 015. O escopo foi limitado a instituições/campi, normalização e seed local.
- Artefatos: modelos Prisma `institutions` e `campuses`, enum de jurisdição, FK com `ON DELETE RESTRICT`, índices de sigla/nome/campus/UF e `CHECK` SQL para as 27 UFs; migration `20261103015903_institutions_campuses`. Repositórios Nest e normalizadores de nome, sigla, município, UF e fuso. `verified_at` permanece nulo até revisão humana. O client de banco passou a validar apenas `DATABASE_URL`, sem depender de Redis na seed.
- Seed local idempotente com UFPB, UFCG, UEPB e IFPB. Nomes, jurisdição pública e links de referência foram conferidos em páginas institucionais: [UFPB](https://www.ufpb.br/apresentacao/), [estatuto UFCG](https://sods.ufcg.edu.br/index.php/legislacao/estatuto/estatuto-ufcg), [UEPB](https://uepb.edu.br/) e [PDI IFPB](https://pdi.ifpb.edu.br/capitulos/capitulo-01.html). Não foram criados campi, processos ou editais na seed; o script recusa banco fora de loopback.
- Validação prescrita: em `alem_do_sisu_step015` **local vazio**, `db:migrate:deploy` aplicou baseline e migration 015; `db:migrate:status` PASS. Duas execuções da seed mantiveram exatamente quatro instituições. Teste de integração: 2/2 PASS, cobrindo quatro instituições com fonte oficial e sem `verified_at`, campus válido temporário, rejeição de campus órfão via FK, UF inválida via normalizador e `CHECK`, e duplicidade normalizada. Após o teste: 4 instituições e 0 campi. A primeira execução do teste encontrou um uso incorreto de `assert.rejects` para erro síncrono; corrigido para `assert.throws` e repetido verde.
- Qualidade: `corepack pnpm install --frozen-lockfile`, `format:check`, `lint`, `typecheck`, `test` (6/6), `test:e2e` (1/1) e `build` PASS. `git diff --cached --check` será executado após staging. Fontes automáticas, URLs candidatas e publicação continuam fora deste passo. G1 permanece pendente até 029; nenhum push, deploy ou migration de produção.

## Passo 016 — evidências

- Estado real antes do passo: backend limpo em `b8dbabc1774607ebf9f5b39df55c602193f36e4d`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidas arquitetura §§ 1, 4.1–4.2, 5, 6 e 7 e instruções 016. A abrangência da allowlist era ambígua; o usuário escolheu host exato e o ADR 0006 foi aceito antes da migration.
- Artefatos: modelos Prisma `allowed_domains` e `sources`, migration `20261103152248_source_registry`, FKs que vinculam fonte/host à mesma instituição, URL única por instituição, `CHECK` de frequência/prioridade e bloqueio de `collection_allowed` sem `reviewed_at`. Repositórios Nest validam HTTPS, DNS público, host exato, URL de evidência, frequência e prioridade. Fonte começa `DRAFT` e domínio sem permissão de coleta. Política em `docs/engineering/source-registry.md`.
- Validação prescrita: em `alem_do_sisu_step016` **local vazio**, `db:migrate:deploy` aplicou as três migrations e a seed criou as quatro instituições. Teste de integração 3/3 PASS: duas fontes oficiais distintas da UFPB no mesmo host, rejeição de `drive.ufpb.br` não listado, rejeição do host em outra instituição e de ativação sem revisão. Após cleanup: 4 instituições, 0 domínios permitidos, 0 fontes. Teste unitário rejeitou IP privado, localhost, protocolo HTTP, credenciais, porta customizada e caracteres de controle.
- Qualidade: `corepack pnpm install --frozen-lockfile`, `db:migrate:status`, `format:check`, `lint`, `typecheck`, `test` (8/8), `test:e2e` (1/1) e `build` PASS. O primeiro lint encontrou uma regex com caracteres de controle; a validação foi reescrita sem regex e toda a sequência foi repetida verde. `git diff --cached --check` será executado após staging.
- Pendências: validar DNS resolvido e redirecionamentos a cada fetch no coletor futuro; revisar acesso, licenças e retenção por fonte antes de permitir crawling. Nenhuma busca automática, publicação, push, deploy ou migration de produção. G1 permanece pendente até o passo 029.

## Passo 017 — evidências

- Estado real antes do passo: backend limpo em `f5c4745318c4abf6c2ef0f126f192f60c03530ed`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidas arquitetura §§ 1, 4.1–4.3, 5, 6 e 7.2 e instruções 017. O escopo de deduplicação entre fontes era ambíguo; o usuário escolheu identidade global por URL e o ADR 0007 foi aceito antes da migration.
- Artefatos: migration `20261103153048_discovery_records` com `crawl_runs`, `discovered_urls` e `discovery_observations`; unicidade global da URL canônica, observação por execução, FKs de fonte/execução, contadores e `CHECK` de tentativa, estado, HTTP status e pontuação. Repositórios Nest registram execução, resultado classificado e descoberta transacional, sem fazer HTTP nem publicar candidatos. Semântica e limites em `docs/engineering/discovery-records.md`.
- Validação prescrita: quatro migrations aplicadas em `alem_do_sisu_step017` **local vazio**; `db:migrate:status` informou schema atualizado. A mesma URL oficial do corpus, detectada três vezes por duas fontes e com fragmento em uma ocorrência, resultou em 1 candidato, `seen_count=3` e 2 observações com contagens 2 e 1. Observação com execução de outra fonte foi rejeitada e revertida. Teste de integração 4/4 PASS, incluindo os passos 015–016; após cleanup: 4 instituições, 0 fontes, 0 execuções, 0 candidatos e 0 observações.
- Qualidade: `corepack pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `test` (8/8), `test:e2e` (1/1) e `build` PASS. `git diff --cached --check` será executado após staging. Nenhum fetch, crawling, publicação, push, deploy ou migration de produção.
- Pendências: resolver DNS/redirecionamentos e permissões de acesso antes de qualquer fetch; snapshots e versões entram no passo 018. G1 permanece pendente até o 029.

## Passo 018 — evidências

- Estado real antes do passo: backend em `10d2058d34743b6477d056908c65c15512a58650`, com rascunho não rastreado do ADR 0008 e preparação do progresso; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 018, arquitetura §§ 3.1, 4.2, 6 e 10.1 e política de coleta. O usuário aceitou metadados versionados e storage local **somente para fixtures de teste**; ADR 0008 aceito antes da migration.
- Artefatos: migration `20261103154133_document_snapshots` cria `document_blobs` com identidade SHA-256 e `documents` com URL, MIME, versão, captura, último avistamento, `storage_key` e vínculo opcional ao candidato. FKs garantem correspondência de hash e chave; checks restringem hash, tamanho, MIME e versão. `DocumentsRepository` mantém histórico por URL e reaproveita blob por hash; `FixtureLocalStorage` grava apenas bytes sintéticos em diretório temporário sob `NODE_ENV=test`. Política em `docs/engineering/document-snapshots.md`.
- Validação prescrita: cinco migrations aplicadas em `alem_do_sisu_step018` **local vazio** e `db:migrate:status` PASS. Teste com HTML sintético: recaptura idêntica manteve ID/versão; bytes novos criaram versão 2; retorno aos bytes originais criou versão 3 e reutilizou o blob; outra URL compartilhou o mesmo hash. Resultado temporário: 4 documentos, 2 blobs; após cleanup no banco: 4 instituições, 0 documentos, 0 blobs. URL oficial foi rejeitada mesmo em teste; storage fora de `NODE_ENV=test` foi rejeitado. Integração 5/5 PASS, incluindo regressões 015–017.
- Qualidade: `corepack pnpm install --frozen-lockfile`, `db:validate`, `db:migrate:status`, `format:check`, `lint`, `typecheck`, `test` (8/8), `test:e2e` (1/1), `test:integration` (5/5) e `build` PASS. O primeiro lint exigiu preservar a causa de um erro de storage; corrigido e suíte repetida verde. `git diff --cached --check` será executado após staging. Nenhum PDF ou HTML institucional foi copiado, e não houve push, deploy ou migration de produção.
- Pendências: decisão de provedor de produção, licença e prazo de retenção por fonte; MIME real, limite e expiração no futuro coletor autorizado. G1 permanece pendente até 029.

## Passo 019 — evidências

- Estado real ao iniciar: backend limpo em `4eadb4b9bfe04e45715a8c746d8377252984c718`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 019, arquitetura §§ 1.2, 5.3–5.4, 6–6.2, glossário e máquina de estados. Usuário escolheu tabelas filhas e data/hora separadas; ADR 0009 aceito antes da migration.
- Artefatos: migration `20261103160000_processes_offerings_windows`, repositórios Nest de processos, ofertas, janelas e requisitos, documentação de modelo e teste de integração sintético. Constraints de banco rejeitam vagas negativas e relacionamentos entre instituições diferentes. Nenhuma publicação ou coleta.
- Validação prescrita: seis migrations aplicadas em banco **local vazio** `alem_do_sisu_step019`; integração 6/6 PASS. Processo sintético com dois cursos, reservas e janelas distintas preservou os detalhes; prazo só com data manteve hora nula. Vagas negativas e campus de outra instituição foram rejeitados. Dados de teste removidos após execução.
- Geração SQL: `migrate dev --create-only` parou em aviso de unique index no modo não interativo; `migrate diff` contra o banco local do passo 018 produziu SQL revisado, com checks explícitos. Nenhuma migration de produção.
- Qualidade final: `pnpm install --frozen-lockfile`, `db:validate`, `db:migrate:status`, `format:check`, `lint`, `typecheck`, `build`, `test` (8/8), `test:e2e` (1/1) e `test:integration` (6/6) PASS. Execução inicial paralela de build e teste colidiu na geração do Prisma; repetidos serialmente, ambos verdes. O Compose local desligou entre comandos; reiniciado no mesmo comando da verificação de banco, com migration e integração verdes. `git diff --check` PASS.
- Pendências: evidências/revisões/decisões entram no 020. G1 permanece pendente até 029. Nenhum push, deploy, migração de produção ou dado público publicado.

## Passo 020 — evidências

- Estado real antes do passo: backend limpo em `430dffd5d5634a958c2fa2525a8695c39a3daae2`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 020 e arquitetura §§ 5.2–5.4, 6–6.2, incluindo histórico de retificações, evidência por campo e estados separados.
- Artefatos: migration `20261103163000_evidence_revisions_reviews` cria `evidence`, `revisions`, `review_decisions` e `publication_status` com default `RASCUNHO`. Revisões possuem predecessor do mesmo processo; triggers impedem UPDATE/DELETE da trilha. Repositório Nest apenas acrescenta registros e consulta histórico, sem comando de publicação. Sem fonte oficial real ou link inventado.
- Validação prescrita: sete migrations aplicadas em banco **local vazio** `alem_do_sisu_step020`; seed local das quatro instituições. Integração 7/7 PASS: retificação sintética manteve versão anterior, decisão contém ator/motivo/horário e UPDATE foi rejeitado; transação revertida deixou zero decisões de teste. G1 permanece pendente até 029.
- Qualidade final: `db:validate`, `typecheck`, `format:check`, `lint`, `build`, `test` (8/8), `test:e2e` (1/1) e `test:integration` (7/7) PASS. O teste de integração usa somente banco local; `git diff --check` e `git diff --cached --check` conferidos antes do commit.
- Pendências: índices/seed histórica no 021; identidade administrativa e regras de aprovação em etapas posteriores. Nenhum push, deploy ou migration de produção.

## Passo 021 — evidências

- Estado real antes do passo: backend limpo em `22efa252aca6bf729364c771789c43fb05e629d2`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 021 e arquitetura §§ 1.2, 6–6.2 e 12.2. A seed histórica era ambígua perante a proibição de editais inventados; o usuário escolheu UFPB-12, já conferido no corpus, em rascunho e bloqueado de publicação. ADR 0010 aceito antes da migration.
- Artefatos: migration `20261103170000_query_indexes_historical_seed` adiciona índices de publicação, instituição, tipo/ENEM, modalidade/grau, prazo e GIN trigram para curso; checks para ano, URL HTTPS e demonstração histórica não publicável. Seed local acrescenta UFPB-12 com URL e janela oficiais do corpus, sem preencher gratuidade/vagas não confirmadas, sem PDF e sem publicação.
- Validação prescrita: oito migrations aplicadas em banco **local vazio** `alem_do_sisu_step021`; seed reexecutada duas vezes no teste sem duplicatas. Integração 9/9 PASS: histórico manteve um processo e uma janela, `PUBLICADO` foi rejeitado por constraint, `EXPLAIN` indicou que índices de publicação e trigram podem ser usados. O teste força o planejador a considerar índices porque o banco pequeno favoreceria leitura sequencial.
- Qualidade final: `db:validate`, `format:check`, `lint`, `typecheck`, `build`, `test` (8/8), `test:e2e` (1/1) e `test:integration` (9/9) PASS. Migration aplicada em banco local novo; diff revisado sem dados reais publicados.
- Pendências: testes amplos de migrations e recuperação entram no 022. G1 permanece pendente até 029; nenhum push, deploy ou migration de produção.

## Passo 022 — evidências

- Estado real antes do passo: backend limpo em `b6ed11deec45d2a1421ff714ae00755717df56c2`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 022 e arquitetura §§ 6–6.2, 10–11 e 12.1. CI anterior só verificava qualidade, sem PostgreSQL.
- Artefatos: job `database` em `.github/workflows/ci.yml` com PostgreSQL efêmero, migrations desde schema vazio, status, seed e testes; `test/integration/db/invariants.test.mjs` cobre FKs restritivas, limpeza explícita e checks SQL; `docs/ops/migrations.md` documenta reset descartável, backup verificado e recuperação sem autorizar produção.
- Validação prescrita: reprodução local do job em `alem_do_sisu_step022` **novo**: oito migrations aplicadas, `migrate status` atualizado, seed e integração 11/11 PASS. `format:check`, `lint`, `typecheck`, `build`, `test` (8/8), `test:e2e` (1/1), parse YAML e `git diff --check` PASS. O job remoto não foi executado porque não houve push; o YAML está preparado e a sequência foi reproduzida localmente.
- Pendências: verificação real do runner quando houver atualização remota autorizada; sem push por instrução expressa. G1 permanece pendente até 029. Nenhuma migration em produção.

## Passo 023 — evidências

- Estado real antes do passo: backend limpo em `6ac81b75835b101ea3cb31ae415d3e68d36cb050`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 023 e arquitetura §§ 7, 8, 9 e 12. O código possuía somente `/health` fixo, sem prontidão ou padrão de erros.
- Artefatos: `/ready` consulta PostgreSQL e Redis sem execução de DDL; `/health` continua liveness. Filtro global devolve erros estáveis sem mensagem interna e com ID de correlação. Utilitário de paginação limita entrada. Job CI de banco recebe Redis efêmero. Documentação em `docs/engineering/api-errors.md`. O cliente Redis segue API documentada pelo projeto ioredis; Nest documenta filtros globais.
- Validação prescrita: unitários 9/9, E2E 1/1 (health, ready indisponível, 404 e ausência de segredo), integração 12/12 com dependências locais saudáveis e falhas simuladas separadas de banco e Redis; logs identificaram o componente, resposta não mostrou causa sensível. `lint`, `typecheck`, `build` PASS. Nenhum push ou deploy.
- Qualidade final: `pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `build`, `test` (9/9), `test:e2e` (1/1), `test:integration` (12/12), parse do YAML e `git diff --check` PASS.
- Pendências: endpoints públicos de dados vêm nos passos 024–025; G1 segue pendente até 029. Nenhum push, deploy ou migration de produção.

## Passo 024 — evidências

- Estado real antes do passo: backend limpo em `2b1dc36026c9aa57919c0d352d429e4e56482da1`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 024 e arquitetura §§ 7–9 e 12. Usuário decidiu exigir instituição pública revisada, fonte oficial ativa em domínio revisado e verificação individual do campus. ADR 0011 aceito antes da migration.
- Artefatos: migration `20261103173000_campus_verification` adiciona `campuses.verified_at` e índice; `GET /api/v1/institutions` usa paginação estável, projeta apenas dados públicos e horários agregados de monitoramento, sem URLs/seletores de fontes. Prefixo `/api/v1` segue arquitetura; `/health` e `/ready` continuam na raiz.
- Validação prescrita: nove migrations aplicadas em banco **local vazio** `alem_do_sisu_step024`; seed sem instituições verificadas. Integração 13/13 PASS após manter sessão WSL ativa: fixture local simulou revisão de UFPB, uma fonte e dois campi; somente o campus revisado apareceu, paginação e erro 400 funcionaram, e campos internos foram ausentes. Cleanup devolveu a seed ao estado não verificado. Uma execução anterior falhou quando o serviço PostgreSQL do WSL encerrou durante a suíte; repetição completa com sessão ativa foi verde.
- Qualidade final: `pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `build`, `test` (9/9), `test:e2e` (1/1), `test:integration` (13/13) PASS. Não há cobertura completa prometida nem dado novo publicado.
- Pendências: facetas publicadas no 025. G1 segue pendente até 029; nenhum push, deploy ou migration de produção.

## Passo 025 — evidências

- Estado real antes do passo: backend limpo em `50fcea80a14fc6898e4555d65a24eba4667b2f42`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 025 e arquitetura §§ 7–9 e 12. Usuário escolheu contagens com todos os filtros ativos, registradas no ADR 0012 aceito antes do commit.
- Artefatos: parser de UF/modalidade/tipo/ENEM, consulta limitada a processos publicados elegíveis, `GET /api/v1/filters` e agregação por processo distinto. UF e modalidade são satisfeitas pela mesma oferta. Rascunhos e demonstração histórica ficam fora.
- Validação prescrita: `pnpm install --frozen-lockfile`, `db:validate`, `db:migrate:status` (nove migrations em dia no banco local), `format:check`, `lint`, `typecheck`, `build`, `test` (10/10), `test:e2e` (1/1) e `test:integration` (15/15) PASS. Teste HTTP confirmou resposta vazia para a seed em rascunho e erro 400 para parâmetro inválido; teste em transação revertida cobriu filtros combinados, multi-oferta, mesma oferta para UF/modalidade e ENEM trivalente. Nenhum dado sintético persistiu.
- Pendências: avaliação de desempenho da agregação em memória quando houver volume real; a busca pública completa entra no 026. G1 segue pendente até 029; nenhum push, deploy ou migration de produção.

## Passo 026 — evidências

- Estado real antes do passo: backend limpo em `50a08f22384afa854391e7706a4b332d102653f3`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 026 e arquitetura §§ 7–9 e 12. O endpoint de facetas existia, mas não havia busca pública. O usuário decidiu `open_only` com qualquer janela completa aberta e `sort=recent|deadline|course`; ADR 0013 aceito antes da migration.
- Artefatos: `GET /api/v1/processes` com todos os parâmetros do roteiro, limites, normalização de diacríticos, ENEM trivalente, paginação e desempate estável por ID. Migration local `20261103193000_process_verified_at` registra verificação de processo e índice. Apenas processos publicados, revisados, com URL de referência, tipo e instituição pública verificada entram na resposta. Demonstração histórica continua em rascunho. Cálculo de janela usa fuso e rejeita horários ausentes ou ambíguos. Contrato e limitação documentados em `docs/engineering/public-search.md`.
- Validação prescrita: `pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `test` com build (12/12), `test:e2e` (1/1), `test:integration` (17/17) e `git diff --check` PASS. Banco e Redis locais; fixture sintética publicada existe somente dentro de transação revertida. Testes cobrem catálogo vazio, erro 400, acentos, ENEM `true`/`false`/`unknown`, janela completa, prazo parcial, três ordenações e páginas estáveis. A migration foi aplicada apenas ao banco descartável local `alem_do_sisu_step026`. A suíte também aceitou o novo índice de publicação como plano válido. Uma repetição falhou por comando local incorreto e outra por credencial de teste incorreta; a execução final com infraestrutura e configuração corretas ficou verde.
- Pendências: medir latência e memória da ordenação sobre todos os candidatos antes de escala; validar URL oficial contra a fonte no fluxo editorial antes de qualquer publicação real; função geral de estados de prazo no 028. Houve aviso de depreciação de concorrência interna do `pg` na integração, sem falha. G1 segue pendente até 029; nenhum push, deploy ou migration de produção.

## Passo 027 — evidências

- Estado real antes do passo: backend limpo em `0a874fe2f0f18566b581a0f394641d8f453eb6a8`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 027 e arquitetura §§ 7–9 e 12. Havia listagem e facetas, sem detalhe nem verificação do host da URL principal. Usuário escolheu host exato de domínio revisado da instituição com fonte ativa; ADR 0014 aceito antes da implementação.
- Artefatos: `GET /api/v1/processes/:id` retorna dados públicos de edital, instituição, ofertas, reservas, janelas, requisitos e evidências. UUID inválido recebe 400; rascunho, demonstração histórica ou URL principal sem fonte verificada recebem 404. Links secundários inválidos não aparecem. Lista e facetas aplicam a mesma validação de host para manter coerência. Dados privados de revisão, seletores e storage não entram no DTO. Contrato documentado em `docs/engineering/public-detail.md`.
- Validação prescrita: `pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `test` com build (12/12), `test:e2e` (1/1), `test:integration` (19/19) e `git diff --check` PASS. Fixture sintética publicada e links de teste foram criados apenas em transação revertida. Testes cobrem 404 para histórico/rascunho, 400 para ID malformado, URL principal em host externo, links secundários ocultos, oferta, prazo parcial sem hora presumida, reserva, requisito, evidência e remoção de lista/facetas quando a fonte é pausada. Não houve migration neste passo.
- Pendências: validar editorialmente cada edital antes de qualquer publicação; implementar estado completo de prazos no 028 e contrato tipado no 029. Aviso de depreciação do `pg` observado na transação de integração, sem falha. Uma tentativa de integração encontrou a senha do volume local divergente do `.env`; a credencial do papel no banco de teste local foi sincronizada e a repetição completa passou. G1 segue pendente; nenhum push, deploy ou migration de produção.

## Passo 028 — evidências

- Estado real antes do passo: backend limpo em `3b956916b8fe06953d651486bc5b94e2e53156cb`; frontend limpo em `b426b7f5a95e76d123322e2e6a3a00ae0d54054f`. Relidos roteiro 028 e arquitetura §§ 5.4, 6.2, 8 e 12. O cálculo do passo 026 estava em `public-search/window-time.ts` e só identificava janela aberta e próximo fim futuro.
- Ambiguidade resolvida: a arquitetura não define como agregar várias janelas quando uma está parcial ou ambígua. O usuário escolheu a regra conservadora no ADR 0015: janela completa aberta prevalece; sem aberta, qualquer janela incerta torna o resultado indeterminado; futuro completo resulta em previsto; todas completas e encerradas resultam em encerrado. O cálculo individual e o mapeamento público seguem o glossário.
- Artefatos: cálculo centralizado em `deadlines/deadline-state.ts`, estados internos `OPEN/CLOSED/UPCOMING/UNKNOWN`, mapeamento público `ABERTA/ENCERRADA/PREVISTA/INDETERMINADA`, `applicationStatus` na lista, detalhe e janelas, e documentação `docs/engineering/deadlines.md`. Datas civis, horas ausentes, transições de fuso ambíguas e limites exatos são preservados. `open_only` usa a mesma função central. Teste de readiness foi corrigido para não confundir dígitos aleatórios do request ID com vazamento da porta.
- Validação: `pnpm install --frozen-lockfile`, `db:validate`, `format:check`, `lint`, `typecheck`, `test` com build (15/15), `test:e2e` (1/1), `test:integration` (19/19) e `git diff --check` PASS em banco e Redis locais. Uma execução intermediária da integração falhou apenas porque o request ID aleatório continha `6399`; a asserção agora verifica a mensagem pública e a suíte completa foi repetida verde. Repetir antes do commit após a aceitação do ADR.
- Pendências: G1 só será avaliado ao fim do 029; ausência de aviso oficial de suspensão no schema atual, que não pode ser derivado apenas de datas. Nenhum push, deploy ou migration de produção.

## Passo 029 — evidências

- Estado antes do passo: backend em e471d89ec60bb85711181cd14677f3227f6e30b1; frontend em b426b7f5a95e76d123322e2e6a3a00ae0d54054f. Foram relidos o roteiro 029 e a arquitetura §§ 8, 9 e 12. A API pública já tinha os quatro endpoints de leitura, sem contrato OpenAPI nem client Angular gerado.
- Decisão de repositórios separados mantida conforme ADR 0000. O frontend foi commitado como fa0248e555074b3fd322a69048ada63642a7f293 (feat(api): gerar client TypeScript do contrato público); este registro acompanha o commit backend do mesmo passo.
- Artefatos: OpenAPI canônico NestJS em apps/api/openapi/public-v1.json, servido em /api/v1/openapi.json e /api/v1/docs; schemas públicos explícitos, sem rotas ou campos editoriais. Cliente TypeScript Angular gerado e versionado em apps/web/src/app/core/api/generated/, com contrato espelhado em contracts/public-v1.json. Guia de evolução compatível em docs/engineering/openapi.md e checks de geração nos dois CI.
- O JSON canônico é ignorado pelo Prettier: sua formatação é controlada pelo gerador NestJS e verificada byte a byte por openapi:check.
- Contrato protegido por testes de operação, parâmetros e campos essenciais; E2E consulta o JSON servido e confirma ausência de rota administrativa. O gerador do Angular foi executado duas vezes sem alterar hashes; o espelho frontend e o arquivo canônico tiveram SHA-256 idêntico.
- Backend: pnpm install --frozen-lockfile, db:validate, format:check, lint, typecheck, test (17/17), test:e2e (1/1), openapi:check e git diff --check PASS. Frontend: pnpm install --frozen-lockfile, format:check, lint, typecheck, test (1/1), build, test:e2e (1/1), geração determinística e git diff --check PASS.
- Gate G1: PostgreSQL local em 127.0.0.1:5433/alem_do_sisu recebeu as dez migrations versionadas; db:migrate:status confirmou schema atualizado. Seed local confirmou quatro instituições e um edital histórico em rascunho. O shell Angular existente compilou. G1 PASS. Nenhuma migration de produção, push ou deploy.
- Pendências: conectar o client Angular às jornadas de busca nos passos posteriores; provedores e conectores continuam inativos até revisão de fonte e política. Próximo passo: 030.

## Passo 030 — evidências

- Estado antes do passo: backend limpo em 7396e73; frontend limpo em fa0248e555074b3fd322a69048ada63642a7f293. Relidos roteiro 030 e arquitetura §§ 3, 4, 7 e 11. O bootstrap Nest independente já existia desde o passo 007, mas encerrava logo após a inicialização por não haver consumidor de fila.
- Artefatos: WorkerRuntime mantém o contexto disponível até o encerramento e libera seu keepalive no hook OnApplicationShutdown. O bootstrap mantém Nest ApplicationContext, instala hooks de sinais e aceita mensagem IPC de shutdown para supervisores/teste Windows; não cria listener HTTP. Prisma desconecta no fechamento do contexto.
- Validação: format:check, lint, db:validate, typecheck, test com build (17/17), test:e2e (2/2) e git diff --check PASS. O E2E iniciou o worker sem API, confirmou que a porta configurada recusou HTTP e solicitou shutdown gracioso. No Windows o teste usa IPC, pois SIGTERM encerra o processo filho de forma forçada; em outros sistemas usa SIGTERM.
- Limite sequencial: ainda não existem filas nem jobs confirmados, então preservação/drain de job não é demonstrável neste passo. Cobrir idempotência, retry e encerramento de jobs depois da implementação BullMQ no 031. G1 segue PASS; nenhum push, deploy ou migration de produção.
- Próximo passo: 031.

## Passo 031 — evidências

- Estado antes do passo: backend limpo em 9220fc0860a4b8bf0c949ec5546adb84b0de668c; frontend limpo em fa0248e555074b3fd322a69048ada63642a7f293. Relidos roteiro 031 e arquitetura §§ 3, 4, 7.2 e 11. Usuário aceitou ADR 0016: o failed set persistido de cada fila é o dead-letter, sem cópia para uma fila central.
- Artefatos: BullMQ 6.5.4 adicionado ao backend; módulo Jobs registra source.refresh, url.fetch, document.classify, document.extract, process.validate e process.recheck. Payloads contêm somente IDs/versões/hash. jobId estável por entidade, três tentativas, backoff exponencial com jitter 50%, completed retido por até sete dias/1.000 jobs e failed sem remoção automática. JobsService fecha filas no shutdown do Nest. Somente WorkerModule importa o módulo; a API pública não depende da fila.
- ADR 0016 atualizado para ACEITO. msgpackr-extract é opcional e seu script de build foi explicitamente negado em pnpm-workspace.yaml; instalação congelada passou.
- Validação: install --frozen-lockfile, db:validate, format:check, lint, typecheck, test com build (20/20), integração Redis direcionada (2/2: deduplicação após conclusão e três falhas até failed persistido) e E2E (2/2: API e worker), git diff --check PASS. Testes Redis executados somente no compose local; não houve migration nem escrita em produção.
- Limite: ainda não há handlers de negócio para consumir essas seis filas; serão adicionados junto às estratégias e conectores dos próximos passos. Nenhuma fonte foi coletada, nenhum edital publicado e nenhum segredo de busca/IA foi ativado. G1 segue PASS; próximo passo 032.

## Passo 032 — evidências

- Estado real antes do passo: backend limpo em `8596f6e`; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Roteiro 032 e arquitetura §§ 4.2-4.3, 7.2 e 11.2 foram relidos.
- ADR 0017 aceito pelo usuário: somente fontes `ACTIVE` com domínio exato revisado e coleta autorizada; excluir `DRAFT`, `PAUSED` e `BLOCKED`; manter `DEGRADED` com prioridade inferior; frequência desde o último check; deduplicação por janela UTC; limite configurável por host exato.
- Artefatos: `apps/api/src/modules/discovery/scheduler/` adiciona scheduler com lock Redis renovável, ordem por saúde/prioridade e limite de jobs pendentes/ativos por host exato. `schedule_version` identifica a janela e alimenta o `jobId` estável. `CRAWL_CONCURRENCY` tem padrão 1 e validação; repositories listam apenas fontes autorizadas. O worker fecha o scheduler no shutdown. Nenhuma fonte é ativada, nenhum HTTP é iniciado e não houve migration.
- Validação: `pnpm install --frozen-lockfile`, `db:validate`, `db:migrate:status` (10 migrations em dia no banco local), `format:check`, `lint`, `typecheck`, `test` (23/23), `test:integration` (24/24 com PostgreSQL/Redis locais), `test:e2e` (2/2), `openapi:check` e `git diff --check`: PASS. Os testes de integração cobrem fontes inelegíveis, prioridade/limite por host e duas instâncias concorrentes disputando o lock e a mesma janela.
- Uma primeira tentativa de integração foi interrompida quando o WSL encerrou os containers; a infraestrutura local foi mantida ativa e a suíte completa foi repetida com sucesso. A repetição emitiu somente avisos de depreciação do cliente `pg`, sem falhas.
- Pendências: os jobs `source.refresh` ainda não têm consumidores de coleta; clientes HTTP responsáveis entram no passo 033. A política de acesso continua exigindo revisão por fonte antes de marcar o domínio como autorizado. Nenhum dado foi publicado, nenhum push foi feito e G1 permanece PASS.

## Passo 033 — evidências

- Estado antes do passo: backend em `0dece45` após o passo 032, com o ADR 0018 e o progresso do início do passo ainda não commitados; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Foram relidos o passo 033 do roteiro e arquitetura §§ 4.2-4.3, 10.1 e 12.1.
- ADR 0018 aceito pelo usuário: respeitar `Retry-After`, repetir com backoff exponencial e jitter até três tentativas; após esgotá-las, propagar a falha para o consumidor do job pausar a fonte para revisão. `403`, bloqueio de `robots.txt` e autenticação não são repetidos.
- Artefatos: `apps/api/src/modules/crawling/http/responsible-http.client.ts` implementa HTTPS apenas, host exato autorizado, resolução DNS com rejeição de endereços não públicos e IP fixado na conexão, bloqueio de redirect cross-host, consulta e aplicação de `robots.txt`, User-Agent explícito, timeout, limite de bytes/MIME e backoff para rede, `429` e `5xx`. A permissão de coleta precisa estar revisada; não há integração a site oficial nem configuração que ative fonte.
- Testes do passo: `test/responsible-http.test.mjs` cobre localhost, metadados cloud, DNS privado, IP literal, redirect interno e cross-host, robots, `Retry-After`, limite de bytes e permissão. Testes usam transporte e DNS injetados; nenhuma requisição externa foi feita.
- Validação: `pnpm test` (31/31), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, build TypeScript e `git diff --check`: PASS. Sem alteração de schema/migration, banco ou contrato OpenAPI.
- Pendência de integração: a pausa persistida da fonte após falha final será conectada ao consumidor de jobs no passo correspondente. Nenhuma fonte foi ativada, nenhum dado foi coletado/publicado e nenhum push foi feito.

## Passo 034 — evidências

- Estado antes do passo: backend limpo em `c94fe30` após o passo 033; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Foram relidos o passo 034 do roteiro e arquitetura §§ 4.3, 5.1 e 7.2.
- Artefatos: `apps/api/src/modules/discovery/parsers/html-link.parser.ts` usa parse5 para ler âncoras, resolver links relativos, remover fragmentos e parâmetros de tracking conhecidos, ordenar query params e deduplicar URLs canônicas. Registra URL de origem e calcula score heurístico a partir do vocabulário de descoberta/exclusão; score é apenas prioridade, não prova de elegibilidade. Links fora da allowlist de hosts exatos e esquemas que não sejam HTTPS são ignorados.
- Dependência: `parse5@7.3.0` declarada diretamente na API e lockfile atualizado.
- Fixture sintético: links repetidos/relativos, parâmetros de tracking e host não permitido em `test/fixtures/discovery/links.html`; nenhum edital ou link oficial foi criado ou consultado.
- Validação: `pnpm install --frozen-lockfile`, `pnpm test` (34/34), `pnpm lint`, `pnpm typecheck`, `pnpm format:check` e `git diff --check`: PASS. Sem migration, escrita em banco, integração com fonte ou alteração de OpenAPI.
- Pendências: o parser ainda não é invocado pelo worker; a integração será feita no passo de consumo correspondente. Nenhum dado foi publicado e nenhum push foi feito.

## Passo 035 — evidências

- Estado antes do passo: backend em `f72eb1b` após o passo 034, com ADR 0019 e progresso preparatórios pendentes; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Foram relidos o passo 035 do roteiro e arquitetura §§ 4.2 e 7.2.
- ADR 0019 aceito pelo usuário: cursor JSONB versionado e `strategyLastExecutedAt` próprios em `Source`; `lastCheckedAt` segue reservado ao agendamento/verificação da fonte. RSS registra chaves dos itens presentes no último feed; sitemap registra URLs canônicas presentes no último snapshot. A primeira execução emite todos os itens allowlisted; seguintes emitem apenas itens ausentes do cursor anterior. Cursor e timestamp são gravados juntos após processamento bem-sucedido.
- Artefatos: `apps/api/src/modules/discovery/strategies/` implementa parsers RSS/Atom e sitemap/urlset/sitemapindex, canonicalização de URLs, allowlist de host exato e cursores versionados. `SourcesRepository` lê e grava cursor/data em atualização única, rejeitando cursor incompatível com `Source.kind`. Migration `20261104120000_discovery_strategy_cursor` adiciona os campos JSONB e timestamptz.
- Fixtures RSS e sitemap sintéticas testam URLs incrementais, tracking, hosts não autorizados, XML inválido, entidades proibidas e cursor incompatível. Não houve consulta a feeds reais.
- Validação: instalação congelada, `db:validate`, build, `pnpm test` (41/41), `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `git diff --check`, integração de fontes (1/1) e integração completa (24/24): PASS. A migration foi aplicada somente no PostgreSQL local `127.0.0.1:5433`; `db:migrate:status` confirmou 11 migrations atualizadas.
- Uma primeira execução da integração completa teve timeout transitório no teste de inicialização da API (`filters.test.mjs`); o teste isolado passou e a repetição da suíte completa passou. Permaneceram somente avisos existentes de depreciação de `pg`.
- Nenhum feed real foi consultado, nenhuma fonte ativada, nenhum dado publicado e nenhum push feito.

## Passo 036 — evidências

- Estado observado ao iniciar: backend em `f4b288f` (passo 035), com apenas ADR 0020 e progresso preparatórios pendentes; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Reexaminados ambos os repositórios, o passo 036 do roteiro e arquitetura §§ 4.1, 7.2 e 15.3.
- ADR 0020 aceito após decisão do usuário: quota diária UTC no Redis por host DNS exato; `SEARCH_DAILY_QUOTA_PER_HOST=0` por padrão; uma tentativa admitida consome quota mesmo se o provedor falhar; sem provedor/conector ativo, chave externa não é exigida. Redis indisponível fecha a busca externa e aciona fallback.
- Artefatos: adapter `SearchProvider` e construtor `site:<host> <termos>`; serviço aplica quota, usa fallback fornecido pelo consumidor e filtra resultados externos e de fallback para URLs HTTPS do host exato. Implementação Redis usa operação Lua atômica `INCR`/`EXPIREAT` em chave por data UTC e host. `SearchProvidersModule` é registrado somente no worker. Nenhum provedor comercial foi configurado.
- Configuração: `SEARCH_DAILY_QUOTA_PER_HOST` é inteiro seguro não negativo, default zero no worker e `.env.example`; busca só opera com provider injetado e quota positiva. Segredos de busca seguem adiados até ativação de conector.
- Testes prescritos adicionados em `test/search-provider.test.mjs`: consulta/host autorizado, normalização de termos, URLs inseguras e hosts diferentes, deduplicação, quota zero/exaurida, falha de Redis/provedor, isolamento por host/data UTC e expiração atômica. Provider e Redis são mocks; nenhuma chamada paga ou externa ocorre.
- Validação: `corepack pnpm test` (49/49), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem migration, alteração OpenAPI, integração com fonte, publicação ou escrita em banco.
- Pendências: nenhum provedor real foi escolhido/ativado; consumidor de jobs deve fornecer o fallback das estratégias oficiais HTML/RSS/sitemap quando a descoberta for conectada. Nenhum dado foi coletado/publicado e nenhum push foi feito.

## Passo 037 — evidências

- Estado observado ao iniciar: backend em `91df9b5` após o passo 036, com ADR 0021 e progresso preparatórios pendentes; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Foram relidos o passo 037, arquitetura § 4.3, glossário de domínio e rótulos do corpus.
- ADR 0021 aceito após decisão do usuário: descarte só por texto âncora que identifique explicitamente SiSU regular/SiSU+, seleção de pós-graduação ou curso técnico integrado/de nível médio. Menções isoladas, URL sem texto conclusivo e sinais conflitantes permanecem candidatos; URL e palavras seed podem apenas priorizar. A heurística não prova elegibilidade ou publicação.
- Artefatos: `apps/api/src/modules/discovery/relevance/relevance.classifier.ts` normaliza acentos/URLs, pontua sinais positivos e negativos, devolve decisão e motivos de exclusão. `html-link.parser.ts` usa a classificação e remove somente descartes explícitos; links incertos seguem para revisão. Sem schema/migration.
- Validação com corpus: teste lê `docs/research/golden-dataset.csv` e cobre UFPB-12 histórico, IFPB-15 ENEM próprio fora do SiSU, UFPB-06 seleção específica, UFPB-05/07 e UFCG-05 negativos que não podem ser descartados por URL isolada, e UFCG-02 `PENDING_REVIEW`. Fixture sintética cobre âncoras explícitas de SiSU regular, pós-graduação e curso técnico, além de menção isolada e sinais contraditórios. Nenhum edital/link oficial foi criado ou consultado.
- Validação: `corepack pnpm test` (53/53), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem chamadas externas, banco, migration ou alteração OpenAPI.
- Pendências: conectores oficiais da UFPB/UFCG seguem para o passo 038; candidatos priorizados ou mantidos não se tornam elegíveis nem públicos sem revisão humana. Nenhum dado foi publicado e nenhum push foi feito.

## Passo 038 — evidências

- Estado observado ao iniciar: backend limpo em `8192885` após o passo 037; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Reexaminados ambos os repositórios, roteiro 038, arquitetura §§ 4.1–4.3 e 10.1, matriz de fontes e política de coleta.
- A matriz confirma as URLs/hosts `www.prg.ufpb.br/editais/ingressantes/` e `comprov.ufcg.edu.br/graduacao.html`. A coleta permanece desabilitada: UFPB aguarda revisão dos termos; UFCG aguarda revisão dos termos/licença e retenção. Não foi feita requisição de rede nem ativação de fonte.
- Artefatos: `apps/api/src/modules/discovery/connectors/institution-connectors.ts` define `HTML_INDEX`, seletor `a[href]`, frequência proposta de 1440 minutos, `DRAFT`, `collectionAllowed=false` e `PENDING_REVIEW`. O helper só processa HTML fornecido localmente e exige host exato. O host `drive.ufpb.br` continua fora da allowlist da fonte UFPB e é rejeitado.
- Fixtures v1 sintéticas por instituição contêm somente URLs oficiais já listadas em `test/fixtures/institutions/candidate-manifest.csv`; não são snapshots nem cópias de conteúdo. Testes confirmam configuração contra a matriz, geração local de candidatos, exatidão de host e ausência de URLs fora do manifesto.
- Validação: `corepack pnpm test` (57/57), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem alterações de schema/migration, banco, API pública ou OpenAPI.
- Pendências: não ativar ou agendar UFPB/UFCG até revisão humana de política/licença/retenção; nenhum edital ou candidato foi publicado e nenhum push foi feito.

## Passo 039 — evidências

- Estado observado antes do passo: backend limpo em `78b5f9d` após o passo 038; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos roteiro 039 e arquitetura §§ 4.1–4.3 e 10.1; a regra de descarte por texto âncora explícito segue registrada no ADR 0021.
- Política das fontes: UEPB (`uepb.edu.br`) permanece manual apenas após robots 403; IFPB (`estudante.ifpb.edu.br`) aguarda revisão de termos. UFPB e UFCG mantêm as pendências já documentadas. Os quatro conectores estão em `DRAFT`, `collectionAllowed=false` e `PENDING_REVIEW`; nenhum acesso de rede foi executado nem fonte ativada.
- Artefatos: conectores UEPB/IFPB isolados em arquivos próprios; fixtures sintéticas versionadas usam somente URLs oficiais já presentes no manifesto revisado. Execução offline informa status, contagem de candidatos, origem, `lastCheckedAt` e `lastSuccessAt` quando há sucesso. `CrawlRunsRepository` grava as datas de verificação/transação de modo atômico; falhas preservam o último sucesso.
- Validação: `corepack pnpm test` (59/59), `node --test test/integration/discovery.test.mjs` (1/1 no PostgreSQL local), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. A integração inicialmente não alcançou o PostgreSQL desligado; após iniciar o contêiner local já existente, repetiu e passou. Nenhuma migration foi aplicada.
- Pendências: revisão humana dos termos/licença/retenção por host; UEPB continua proibida para coleta automatizada até esclarecer o 403. Conectores não agendam jobs e não publicam candidatos. Nenhum push foi feito.

## Passo 040 — evidências

- Estado observado antes do passo: backend limpo em `606dea8` após o passo 039; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos roteiro 040 e arquitetura §§ 3, 4, 7 e 11.
- ADR 0022 aceito pelo usuário: uma observação por candidato/`crawlRunId`; replays preservam contadores e timestamps; execuções distintas contam uma vez. ADR 0023 aceito: aviso na primeira falha final, alerta após três falhas consecutivas ou duas frequências desde o último sucesso; zero candidatos é aviso de revisão.
- Artefatos: fixture sintética `connector-layout-v2.html` cobre markup alterado, duplicatas canônicas, host externo e exclusão explícita. Testes HTTP simulam 403 e indisponibilidade com transporte mockado. `DiscoveredUrlsRepository` serializa gravações por URL e não altera a observação existente no replay. `docs/ops/connector-replay.md` documenta replay, bloqueios, isolamento da API e limiares de alerta. Nenhum fetch real, snapshot ou publicação.
- Validação: `corepack pnpm test` (62/62), integração local `test/integration/discovery.test.mjs` (2/2), `corepack pnpm test:e2e` (2/2, sequencial), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. A primeira execução de integração encontrou retorno SQL `void` incompatível com a desserialização do Prisma; o lock transacional foi mantido com projeção escalar e a integração repetida passou. O E2E paralelo excedeu o timeout de inicialização; a execução sequencial passou e o script foi ajustado para ser estável.
- Sem mudança de schema ou migration. Alerta ainda sem emissor/integração operacional; fila não consome conectores, e os quatro permanecem desativados. Nenhuma fonte acessada, nenhum dado publicado e nenhum push/deploy.

## Passo 041 — evidências

- Estado observado antes do passo: backend limpo em `936324d` após o passo 040; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos o roteiro 041 e arquitetura §§ 4, 5, 6 e 7.
- ADR 0008 aplicado: `FixtureLocalStorage` grava somente bytes sintéticos sob `NODE_ENV=test`; snapshots oficiais continuam bloqueados até revisão de licença/retenção por fonte e decisão de storage de produção.
- Artefatos: `secure-artifact-fetcher.ts` exige `ResponsibleHttpClient`, URL HTTPS pública, resposta completa HTTP 200 e limite explícito; identifica HTML/PDF pela assinatura/conteúdo, compara MIME e extensão, e produz SHA-256, tamanho, URL de origem, captura, ETag e Last-Modified. Erros tipados retêm URL/status/código sem incluir corpo. `MAX_PDF_BYTES` tem default de 10 MiB e validação positiva; `.env.example` registra o default.
- Validação: `corepack pnpm test` (71/71, incluindo HTML falso sob `.pdf`, bytes acima do limite, bloqueio, tipo desconhecido e metadados); `corepack pnpm test:e2e` (2/2); `node --test --test-concurrency=1 test/integration/documents.test.mjs` (1/1 em PostgreSQL local); `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. O teste de storage escreveu apenas fixture temporária local. Sem migration.
- Pendências: o worker ainda não consome o fetcher, nenhuma fonte foi ativada e nenhum acesso de rede ocorreu; snapshots oficiais e storage de produção continuam bloqueados pela revisão humana pendente. Nenhum dado publicado, push ou deploy.

## Passo 042 — evidências

- Estado observado antes da implementação: backend em `4253cdc`, com apenas a atualização de estado do `PROGRESS.md` pendente; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos o roteiro 042 e a arquitetura §§ 5.2, 6, 7.2 e 10.1.
- ADR 0024 aceito pelo usuário: PDF.js direto. `pdfjs-dist` 6.5.438 foi fixado no lockfile, e o mínimo de Node do backend foi ajustado para 22.13 conforme requisito do pacote.
- Artefatos: `pdf-text.parser.ts` recebe bytes e limites explícitos, usa recursos locais do pacote e retorna página física, linhas, segmentos com coordenadas, candidatos conservadores a título e métricas objetivas de camada de texto. Erros tipados não incluem bytes nem conteúdo do PDF. A fixture sintética gerada por script contém tabela, cronograma, anexo e página sem texto; nenhuma fonte real foi acessada.
- Validação: `corepack pnpm test` (74/74, incluindo fixture e limites), `corepack pnpm test:e2e` (2/2), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem migration ou teste de banco para este parser isolado.
- Pendências: ligação ao worker e isolamento de tempo/memória, OCR, corpus de PDFs autorizados para layouts complexos e política de retenção/storage de snapshots oficiais. Nenhum PDF oficial armazenado, dado publicado, push ou deploy.

## Passo 043 — evidências

- Estado observado antes do passo: backend limpo em `7aa52cc` após o passo 042; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Lidos o roteiro 043 e a arquitetura §§ 4.2, 5.2, 7.2 e 10.1.
- Escopo: normalizador puro com `parse5` existente, seleção de região substantiva, remoção de navegação/rodapé do site, preservação de cabeçalho e contexto editorial do artigo, títulos, seções, tabela e rótulos de links. URLs de documentos só entram como candidatas se usarem HTTPS e host exato fornecido; `<base>` não substitui a URL de origem. Política pública do ADR 0014 continua exigindo fonte ativa e revisão humana.
- Fixture: `long-menu.v1.html` é sintética, com 30 entradas de menu, links internos e entre hosts autorizados, links não revisados e URL insegura. Não contém edital real nem é publicada.
- Validação: `corepack pnpm test` (76/76, incluindo menu grande, contexto, tabela, anexos e allowlist); `corepack pnpm test:e2e` (2/2); `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem migration ou teste de banco para o parser isolado.
- Pendências: decodificação de charset, conteúdo renderizado por JavaScript e layouts específicos exigem avaliação por fonte quando o fluxo for integrado. Nenhum download, snapshot oficial, dado publicado, push ou deploy.

## Passo 044 — concluído localmente

- Estado observado antes do passo: backend em `700bec3` após o passo 043, com a atualização deste `PROGRESS.md` pendente; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos o roteiro 044 e arquitetura §§ 5.2, 7.2 e 10.1.
- ADR 0025 aceito conforme escolha do usuário: Tesseract.js local com modelo português empacotado, fila BullMQ dedicada `document.ocr`, limiar de 40 caracteres úteis, limite configurável de 5 páginas por documento e orçamento global diário UTC, padrão zero. IDs determinísticos e reserva Redis atômica impedem cobrança duplicada da mesma identidade.
- Implementação: PDF.js seleciona páginas com imagem e camada de texto insuficiente; o recognizer renderiza a 2x e aplica limite de 18 milhões de pixels e timeout de 60 s. Usa `tesseract.js` 7.0.0 e `@tesseract.js-data/por` 1.0.0 local, sem URL/CDN. Jobs contêm só documentId, hash, página e versão. Orçamento e limite ficam no config do worker e no `.env.example`.
- Fixtures: `scanned-text.v1.pdf` e `scanned-six-pages.v1.pdf` são imagens sintéticas geradas localmente; nenhuma fonte oficial ou PDF real foi acessado.
- Validação: `corepack pnpm test` passou com 82/82; `corepack pnpm test:e2e` passou com 2/2 na repetição (a primeira execução excedeu o timeout de inicialização de 10 s da API, sem falha no worker); `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. O teste OCR reconheceu texto da imagem sintética; PDF com texto e página em branco sem imagem não produziu candidatos; orçamento zero não enfileirou jobs. Sem migration.
- Pendências: o passo 047 integrará o consumidor da fila com fetch/extração e persistência do resultado; quota continua zero e a fila não está ativada para fontes oficiais. O PDF.js roda no processo do worker, limitado por bytes, páginas, pixels e timeout; produção ainda depende do limite de memória do container. Nenhum dado foi publicado; sem push, deploy ou migração de produção.

## Passo 045 — concluído localmente; ADR 0026 aceito

- Estado observado antes do passo: backend limpo em `b561f36` após o passo 044; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Lidos o roteiro 045 e arquitetura §§ 4.1, 5.2, 6 e 10.1.
- O usuário aceitou o ADR 0026: relações direcionadas entre snapshots imutáveis com tipos ATTACHMENT, TIMELINE, RECTIFICATION e RELATED. O schema e migration adicionam a tabela `document_relations`, duas FKs `RESTRICT`, proibição de auto-relação e unicidade por origem, destino e tipo. Repositório faz upsert idempotente e mantém relações ligadas ao ID da versão observada; `DocumentBlob` continua deduplicado por hash.
- Artefatos: `apps/api/src/modules/documents/versioning/`, migration `20261105150000_document_relations`, teste de integração com fixture local, teste de repositório com fake Prisma e `docs/engineering/document-versioning.md`. Snapshots oficiais continuam bloqueados pelo ADR 0008.
- Validação: `corepack pnpm test` (85/85), `corepack pnpm test:e2e` (2/2 na repetição), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check`, `prisma validate` e `git diff --check`: PASS. O teste local confirmou versões 1 e 2 com hashes/bytes distintos e o vínculo antigo preso à versão 1.
- Pendência operacional: o teste de integração PostgreSQL não pôde ser executado porque `TEST_DATABASE_URL` não está configurada; a URL local do `.env` aponta para 5433, que recusou conexão. Nenhum banco foi criado ou alterado e a migration não foi aplicada. Sem migration de produção, push ou deploy.

## Passo 046 — concluído localmente; ADR 0027 aceito

- Estado observado antes do passo: backend em `40da0f6` após o passo 045, com apenas o progresso e ADR 0027 pendentes; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos o roteiro 046 e arquitetura §§ 4.2, 5.2 e 10.1 antes da implementação.
- O usuário aceitou o ADR 0027: cache estruturado por SHA-256/tipo/versão e retenção opt-in revisada por fonte; sem prazo revisado não há cleanup. Blobs compartilhados e cache só expiram quando todas as origens são elegíveis, preservando documentos, relações e evidências.
- Implementação: `DocumentParseCache` persiste JSON por hash/tipo/versão e os parsers HTML/PDF expõem versões explícitas. `ParserCacheRepository.getOrCompute` reutiliza a saída, exige blob não expirado e valida chave/JSON. `SnapshotRetentionRepository` exige política revisada para todas as associações, calcula o maior vencimento desde a data mais recente de captura/revisão, pagina por cursor SHA-256, apaga bytes/cache e marca o blob sem apagar documentos, relações ou evidências. `SourcesRepository.setSnapshotRetentionPolicy` só habilita prazo positivo com revisão válida. O storage local de fixture permite exclusão idempotente; ADR 0008 continua bloqueando snapshots oficiais.
- Documentação: ADR 0027 aceito e `docs/ops/retention.md` registra critérios, limite operacional e ausência de agendamento/provedor de produção.
- Validação: `corepack pnpm test` (97/97), `corepack pnpm test:e2e` (2/2), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check`, `corepack pnpm --filter @alem-do-sisu/api exec prisma validate` e `git diff --check`: PASS. Os testes cobrem replay de cache por hash/tipo/versão, blob expirado, política inválida, retenção compartilhada, fronteira de vencimento, paginação, preservação de evidências e exclusão local idempotente.
- Pendências: integração PostgreSQL da migration não executada porque `TEST_DATABASE_URL` não está configurada e o PostgreSQL local previamente verificado em `localhost:5433` recusou conexão. Migration criada mas não aplicada; job de cleanup e storage oficial dependem de revisão operacional posterior. Nenhum dado foi publicado; sem push ou deploy.

## Passo 047 — concluído localmente; ADR 0028 aceito

- Estado observado: backend limpo em `cc8cd4a` após o passo 046; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos o roteiro 047 e arquitetura §§ 3.1, 4.2, 5.2, 7.2, 11.2 e 12.1.
- O usuário aceitou o limite do ADR 0028: replay offline da composição existente sem afirmar que valida consumo BullMQ. O `WorkerModule` atual não tem consumidores; esse trabalho funcional permanece fora do passo 047.
- Artefato: `test/e2e/ingestion.test.mjs` compõe `ResponsibleHttpClient` com transporte de fixtures, fetch tipado, `DocumentsRepository` e `FixtureLocalStorage` em diretório temporário, parsers HTML/PDF e cache versionado com adapters em memória. Reexecutar as mesmas fixtures preserva IDs/versões e hashes; o cache evita repetir os parsers. O transporte responde apenas hosts/rotas fixture, sem acesso à rede real.
- Fixtures existentes `long-menu.v1.html` e `table-schedule.v1.pdf` são sintéticas. A métrica por categoria registrou `fetch.MIME_MISMATCH` e `pdf.PARSE_FAILED` em entradas de erro controladas; o caminho válido retornou texto para ambos os formatos e SHA-256 determinístico.
- Validação: `corepack pnpm test:e2e` (3/3), `corepack pnpm test` (97/97), `corepack pnpm lint`, `corepack pnpm format:check` e `git diff --check`: PASS. Sem alteração de worker ou migration neste passo.
- Pendências: consumidores BullMQ e integração real com PostgreSQL/Redis continuam em passos funcionais posteriores. Nenhuma fonte oficial foi acessada, migration aplicada ou dado publicado; sem push ou deploy.

## Passo 048 — concluído localmente

- Estado observado antes do passo: backend limpo em `db06280` após o passo 047; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Lidos o roteiro 048 e arquitetura §§ 5.1, 5.2, 5.3 e 12.1. Os códigos de `selection_type` vieram do glossário/taxonomia revisada, não de novos rótulos inferidos.
- Implementação: Zod 4.6.7 gera schemas estruturais JSON Schema 2020-12 versionados para classificação e extração. Todos os campos contratuais são obrigatórios; valores não confirmados e coleções desconhecidas usam `null`. Janelas mantêm datas, horas e fuso em propriedades separadas. Ofertas, reservas e requisitos são arrays aninhados e aceitam valores nulos.
- Evidência: validação Zod exige, para cada campo crítico não nulo, evidência associada ao caminho do campo, UUID do documento, página/seção e trecho. O JSON Schema gerado não expressa essa dependência entre campos; a validação Zod final é obrigatória, conforme `docs/contracts/README.md`. `institution_id` é contexto fornecido pelo pipeline.
- Artefatos: `apps/api/src/modules/ai/schemas/`, `docs/contracts/classification-v1.json`, `docs/contracts/extraction-v1.json`; `corepack pnpm schemas:generate` recria os arquivos e o teste verifica sincronização. Nenhum provider, prompt ou fluxo de publicação foi adicionado.
- Validação: `corepack pnpm test` (101/101), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Testes cobrem enums, null explícito, campos ausentes, propriedades extras, arrays aninhados, datas/horas, evidência obrigatória e igualdade dos schemas JSON com os artefatos versionados.
- Pendências: adapters de provedor e sua compatibilidade de structured output pertencem ao passo 049; publicação continua sujeita a validação determinística e revisão humana. Nenhuma migration, dado oficial publicado, push ou deploy.

## Passo 049 — concluído localmente; ADR 0029 aceito

- Estado observado antes do passo: backend limpo em `3cef146` após o passo 048; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Lidos roteiro 049 e arquitetura §§ 5.1, 5.2, 7.1, 10.1 e 11.2.
- O usuário escolheu tokens cumulativos por documento em Redis; limite zero desativa chamadas externas. ADR 0029 registra a decisão e o fechamento conservador de reservas. ADR 0004 continua adiando a chave até a ativação de um provider concreto; nenhum fornecedor foi escolhido.
- Implementação: `AiProviderService` impõe timeouts, retries limitados, identidade estável, schema ID, limites máximos de entrada/saída e valida token usage. `RedisAiTokenBudgetStore` reserva atomicamente o teto de todas as tentativas por documento, reconcilia uso confirmado, mantém teto para falhas de uso desconhecido e bloqueia replay do mesmo request ID. Chaves do documento usam hash tag Redis comum e request IDs são guardados como SHA-256. Worker recebe `AI_MAX_TOKENS_PER_DOCUMENT` (inteiro não negativo, default 0) e factory aplica a configuração; fixture de teste funciona offline sem chave. Não há provider externo, chamada real ou dependência da API pública.
- Validação: `corepack pnpm test` (110/110), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Testes cobrem fixture sem segredo, zero bloqueando provider externo, timeout/retry, reconciliação, duplicata, teto, falha do Redis e configuração do worker.
- Pendências: scripts Lua Redis foram verificados com fake de EVAL, sem integração com um servidor Redis real neste passo; validar no ambiente de integração quando disponível. A seleção e validação de segredo de um provider real ficam para a etapa que o ativar. Sem migration, publicação de dados, push ou deploy.

## Passo 050 — concluído localmente; ADR 0030 aceito

- Estado observado: backend limpo no commit `059f907` após o passo 049; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos roteiro 050, arquitetura §§ 4.3, 5.1 e 5.2, ADRs 0001, 0003 e 0021, contrato v1 e corpus aprovado.
- O CSV contém rótulos e referências de seção, mas não os títulos/trechos necessários para medir precisão/recall sem vazamento do gabarito ou texto inventado. A URL, por decisão do ADR 0021, não prova descarte. O checkpoint diz `NEEDS_REVIEW`, enquanto `ClassificationV1` define `PENDING_REVIEW` e `UNKNOWN`.
- O usuário escolheu matriz sintética conservadora. ADR 0030 aceita `PENDING_REVIEW` como representação do `NEEDS_REVIEW` e deixa métricas do corpus real pendentes até haver trechos oficiais revisados. Nenhum novo dado oficial foi adicionado.
- Implementação: `ScopeClassifier` combina o heurístico de descoberta com título, trechos citáveis e fatos de escopo acompanhados de evidência. Regras explícitas rejeitam SiSU regular/SiSU+, pós-graduação, técnico, instituição privada ou curso pago; menções contextuais, conflitos e vagas remanescentes ligadas ao SiSU vão para revisão. Apenas candidatos priorizados chegam ao adapter abstrato de IA; resposta estruturada exige schema v1 e citação curta presente no texto recebido. Exclusão sugerida apenas pelo modelo, citação inventada ou ausência de prova de instituição pública, graduação, gratuidade e seleção própria retorna `PENDING_REVIEW`. Nenhuma classificação publica um processo.
- Validação: matriz de 13 casos **sintéticos** derivados dos ADRs aprovados; precisão e recall `1,0` para `IN_SCOPE` e `OUT_OF_SCOPE` nessa matriz, com os três ambíguos em `PENDING_REVIEW`. `corepack pnpm test` (113/113), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck` e `corepack pnpm format:check`: PASS.
- Pendências: o corpus histórico de 35 artefatos ainda não tem títulos/trechos versionados suficientes para medir precisão/recall real sem vazamento de rótulos; curadoria humana e reavaliação são necessárias antes do gate de qualidade 057/082. O adapter externo segue desativado, sem chave, coleta, migration, publicação, push ou deploy.

## Passo 051 — concluído localmente

- Estado observado antes do passo: backend limpo em `67549d0` após o passo 050; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos roteiro 051 e arquitetura §§ 5.2–5.4, contrato `ExtractionV1` e guia dos contratos.
- Implementação: `StructuredExtractor` envia prompt `extraction-v1` e JSON Schema v1 ao adapter abstrato, preservando `institution_id` do contexto. A saída Zod exige campos nulos explícitos e evidência por campo crítico; checagem adicional exige UUID, página/seção, trecho curto literal recebido e suporte textual para datas, horas, números, taxa de inscrição, ENEM, gratuidade e tipo de seleção. Evidência falsa, valor sem suporte, schema inválido ou instituição trocada retornam `PENDING_REVIEW` sem dados extraídos aceitos. O prompt versionado está documentado em `docs/prompts/extraction-v1.md`.
- Validação: `corepack pnpm test` (117/117), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck` e `corepack pnpm format:check`: PASS. Fixtures sintéticas cobrem janela completa e prazo parcial sem hora inventada, taxa, ENEM, oferta/requisito, citação inventada, mudança de instituição, valor de taxa/hora/tipo não sustentado.
- Pendências: sem provider externo ou consumo de dados oficiais neste passo; qualidade em corpus real, reconciliação e regras de domínio seguem nos passos 052–057. Nenhum resultado foi publicado, nenhuma migration aplicada; sem push ou deploy.

## Passo 052 — concluído; ADR 0031 proposto

- Estado observado: backend limpo em `2cef357` após o passo 051; frontend limpo em `fa0248e555074b3fd322a69048ada63642a7f293`. Relidos roteiro 052, arquitetura §§ 5.3 e 6–6.1, schema Prisma, repositórios de processo/oferta/campus e contrato `ExtractionV1`.
- Lacuna identificada: o payload admite campus/curso nulos e não fornece cidade/ID de campus. ADR 0031 propõe vínculo somente por nome normalizado único de campus verificado na mesma instituição, ou ID escolhido por curador. Enquanto isso, a normalização preservará texto original, chaves de busca e todas as linhas sem criar vínculos incertos.
- Implementação: `normalizeExtractedProcess` valida o payload v1 e contexto da instituição/documento principal, preserva valores crus e normalizados, todas as ofertas, reservas, requisitos, janelas parciais e evidências. Documento desconhecido e curso ausente geram pendências. Vínculo de campus só é aceito por atribuição explícita com índice da oferta, ID, verificação, instituição e nome normalizado compatíveis. Não há escrita no banco nem publicação neste passo.
- Validação: `corepack pnpm test` (121/121), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Testes do passo cobrem múltiplas ofertas, reservas, requisitos, documentos associados, curso desconhecido e rejeição de campus incompatível.
- Pendências: associação automática por nome depende de decisão no ADR 0031. A normalização não inventa campus ou curso; rascunhos incompletos ainda não são persistidos/publicados. Nenhum push, deploy ou migration em produção.

## Passo 053 — concluído; ADR 0032 proposto

- Estado observado: backend limpo em `d832efa`, frontend sem alterações desde `fa0248e`. Relidos roteiro 053, arquitetura §§ 1.2, 2.1, 5.2–5.4 e 6.2, glossário e máquina de estados. A API já possuía normalização, mas `ValidationModule` estava vazio.
- Implementação: validador determinístico de instituição pública/verificada, fonte oficial, graduação, SiSU regular separado de ENEM, mensalidade separada de taxa, prazo de inscrição completo/cronológico, vagas e pendências da normalização. Resultado é sempre invisível até revisão humana; exclusões explícitas recebem `OUT_OF_SCOPE`, demais casos `NEEDS_REVIEW`. Oferta técnica em processo misto não apaga a oferta de graduação.
- Validação: `corepack pnpm test` (126/126), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Casos conflitantes nunca geram publicação.
- Pendências: `ExtractionV1` não modela isenção de taxa; ADR 0032 propõe estrutura e registra revisão obrigatória quando há taxa positiva. O validador ainda não é ligado a escrita/publicação, previstas nos passos posteriores. Nenhum push, deploy ou migration em produção.

## Passo 054 — concluído; ADR 0033 proposto

- Estado observado: backend limpo em `822f717`, frontend sem mudanças desde `fa0248e`. Relidos roteiro 054 e arquitetura §§ 5.2 e 6–6.1. O schema tem unicidade de instituição + edital + ano e documentos por URL/versão; não há vínculo explícito para documento principal do processo.
- Implementação: reconciliador determinístico usa instituição, código normalizado e ano completos; o mesmo ID de documento principal pode vincular extração incompleta sem conflito. Hash igual sem chave conclusiva bloqueia criação duplicada e encaminha à revisão assistida. Códigos conflitantes, candidatos múltiplos e documento compartilhado entre editais também exigem revisão; curso parecido e URL parecida não são chaves.
- Validação: `corepack pnpm test` (133/133), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS após ajuste de formatação. Testes cobrem replay, mudança de URL, hash compartilhado, conflito e editais distintos.
- Pendências: ADR 0033 propõe vínculo tipado e persistido processo–documento principal; o reconciliador ainda não executa escrita no banco. Sem criação/publicação de edital, push ou deploy.

## Passo 055 — mecanismo concluído; ADR 0034 proposto

- Estado observado: backend limpo em `06f3291`, frontend sem mudanças desde `fa0248e`. Relidos roteiro 055, arquitetura §§ 5.4 e 6.2 e máquina de estados. O schema já preserva revisões append-only, evidências e decisões humanas, mas não tinha planejador de diferenças nem registro transacional de candidato.
- Implementação: compara snapshots normalizados, marca mudanças críticas em prazos/ofertas/requisitos e campos de escopo, mantém snapshots e evidências antigas, grava a revisão candidata e as novas evidências na mesma transação e torna replay do documento idempotente. Processo publicado só muda com fonte oficial confirmada e política explicitamente passada: `HIDE` registra evento de sistema e oculta; `KEEP_PREVIOUS` registra evento e mantém a versão pública anterior. Nenhuma opção é padrão enquanto ADR 0034 aguarda escolha.
- Validação: `corepack pnpm test` (143/143), `corepack pnpm test:e2e` (3/3), `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check` e `git diff --check`: PASS. Dez testes direcionados cobrem prazo/requisito crítico, evidências anteriores, replay, fonte não verificada e ambas as políticas.
- Pendências/evidências: o teste da transação usa adapter simulado; não foi possível rodar integração PostgreSQL porque Docker não está instalado/disponível (`docker` não reconhecido). Não houve migration. A escolha do comportamento em produção permanece no ADR 0034 e deve ser explícita no consumidor antes de ativar o fluxo. Sem push, deploy ou escrita em produção.

## Passo 056 — concluído; integração de autenticação fica para 058–059

- Estado observado: backend limpo em `aea3658`, frontend sem mudanças desde `fa0248e`. Relidos roteiro 056, arquitetura §§ 6–9 e `docs/domain/state-machine.md`. Havia apenas `publication_status`; faltava persistir estado de ingestão e aplicar transições.
- Implementação: enum `ProcessIngestionState`, campos `ingestion_state`/`ingestion_state_reason` e índice para a fila; módulo de regras valida arestas de ingestão/publicação. Registrar transição e decisão é atômico, usa comparação do estado anterior e grava ator/motivo. Publicação exige estado `VERIFIED`, fonte oficial, escopo e fatos críticos explicitamente confirmados, humano e permissão. Worker não publica. Rejeitado só reabre com evidência nova; estado arquivado é terminal. A política de retificação crítica permanece parâmetro explícito conforme ADR 0034.
- Validação: `prisma validate`, build, `corepack pnpm test` (150/150), `corepack pnpm test:e2e` (3/3), lint, typecheck, format:check e `git diff --check`: PASS. Testes cobrem permissões, transições inválidas, revisão, requisitos de publicação e auditoria.
- Pendências: migração `20261108120000_process_review_workflow` criada, ainda não aplicada porque Docker e PostgreSQL local não estão disponíveis. Autenticação/verificação de tokens, guards e RBAC conectados a identidade real seguem nos passos 058–059; o passo 056 só recebe ator/escopos fornecidos pela camada confiável. Sem migration em produção, push ou deploy.

## Passo 057 — concluído com limites do corpus registrados

- Estado observado: backend limpo em `f8c0fc8`, frontend sem mudanças desde `fa0248e`. Relidos roteiro 057, arquitetura §§ 2.2, 5.1–5.4, 10.1, 12–13, `docs/quality/metrics.md` e corpus dourado. A matriz tem 35 artefatos e referências por seção, mas não títulos/trechos versionados suficientes para avaliar extração sem vazamento.
- Implementação: avaliador em `apps/api/test/evaluation/metrics.mjs` calcula precisão/recall exatos, cobertura, erro e abstenção por campo; exclui `UNKNOWN` e `NOT_MEASURED`; separa tokens de provider e fixtures; compara regressões por prompt/modelo apenas nos mesmos casos. Relatório versionado em `docs/quality/evaluation-report.md` mantém resultados reais ausentes como `NOT_MEASURED`.
- Evidência de corpus: `python test/fixtures/institutions/validate_golden_dataset.py` confirmou 35 documentos, 4 instituições e os casos ENEM, prazo ambíguo, duplicatas, negativos e retificação.
- Validação: `corepack pnpm test` (154/154), `corepack pnpm test:e2e` (3/3), lint, typecheck, format:check e `git diff --check`: PASS. A matriz pré-existente de 13 casos sintéticos obteve precisão/recall 1,00 em `IN_SCOPE` e `OUT_OF_SCOPE`; os três ambíguos foram encaminhados à revisão. Isso não é desempenho do corpus nem do piloto.
- Pendências: precisão/recall de extração no corpus, custo real por documento e regressão de provider/modelo continuam `NOT_MEASURED`; nenhum provider externo foi chamado. Curadoria humana deve acrescentar títulos e trechos oficiais antes do gate piloto. Nenhuma publicação, push ou deploy.

## Decisions and pending items

### Repository topology (ADR 0000)

The user chose separate Git repositories for frontend and backend. Architecture, roadmap, and this progress log live in backend as the reference shared by both. Each step commits to the relevant repository; if a later step requires atomic changes in both, record both SHAs here. No push is authorized.

### Gates and product boundaries

- Do not treat the source matrix as approval to crawl. Resolve access, license, and retention per source before automating collection.
- Out-of-scope regular selection and SiSU+ remain excluded. Remnant-vacancy process stays in review pending a documented decision.
- No invented notices or links; official data requires an official source and human review before publication.
- ADR 0035 (identity provider) remains proposed. ADR 0036 (server-side roles mapped by issuer+subject) and ADR 0037 (monotonic reviewVersion with HTTP 409 on stale writes) are accepted.

### Style reference

The inspected `style-reference.png` defines a poster/collage language: ivory background, dominant black, extremely heavy sans headings, lime green, intense orange, electric blue and lilac blocks, thick black outlines, offset shadows, angled corners/forms, hand-drawn rays and arrows, halftone photos, a wide search area, and institutional image cards. Extract tokens/components in step 067 and apply them in step 068 with responsive and accessible equivalents. Never present unverified opportunities as current.

## Passo 058 - concluido; ADR 0035 proposto

- Estado observado: backend limpo em `da546dc`. Relidos roteiro 058 e arquitetura secao 7.3; autenticacao OIDC/JWKS generica, configuracao opcional no boot ate ativar guards, rotas publicas anonimas.
- Validacao: build + `corepack pnpm test` (159/159), `corepack pnpm test:e2e` (3/3), lint, typecheck, format:check e `git diff --check`: PASS.
- Pendencias: provedor de identidade ainda nao ativado; ADR 0035 proposto. Sem push, deploy ou migracao de producao.

## Passo 059 - concluido; ADR 0036 aceito

- Decisao do usuario: papeis ADMIN/CURATOR atribuidos no servidor e mapeados pelo par exato issuer+subject. Claims do IdP nao concedem acesso.
- Implementacao: models/migration AdminUser e AuditEvent; guard consulta usuario ativo por papel; trilha de auditoria validada contra motivo vazio, snapshot excessivo e chaves de segredo. ADR 0036 registra provisionamento inicial controlado.
- Validacao: `prisma validate`, build + testes (164/164), E2E (3/3), lint, typecheck, format:check e `git diff --check`: PASS.
- Pendencias: migration nao aplicada; rotas administrativas e provisionamento/audit DB privileges ainda nao ativos. Sem push/deploy/producao.

## Passo 060 - concluido

- Estado observado: backend limpo em `4caa2f2`; relidos roteiro 060 e arquitetura secoes 8 e 10. Implementacao Nest de processos, revisoes, authz e evidencias examinada.
- Implementacao: `GET /api/v1/admin/review-queue` com estado padrao NEEDS_REVIEW, filtros por estado/instituicao, paginacao limitada e ordenacao estavel; `GET /api/v1/admin/processes/:id` apresenta status, ofertas, janelas, requisitos, evidencias, hash/versao de documentos, retificacoes e decisoes. Ambos exigem autenticacao e CURATOR/ADMIN; rotas nao entram no OpenAPI publico.
- Validacao: build + testes (168/168), E2E (3/3; rota admin retorna 401 sem token), lint, typecheck, format:check, `openapi:check` e `git diff --check`: PASS.
- Pendencias: servico testado com adapter Prisma simulado; integracao com banco requer migration aplicada em desenvolvimento. Sem push/deploy/migration de producao.

## Passo 061 - concluido; ADR 0037 aceito

- Decisao do usuario: escolher a melhor abordagem para optimistic locking. ADR 0037 aceito com `reviewVersion` monotonicamente crescente, obrigatorio nas mutacoes e conflito HTTP 409 em versao obsoleta.
- Implementacao: migration adiciona o contador ao processo; fila e detalhe administrativos expoem a versao; aprovacao+publicacao, rejeicao, correcao tipada e ocultacao exigem `expectedReviewVersion`. Todas as mutacoes atualizam a linha do processo por compare-and-swap e incrementam a versao; decisao, ator local, justificativa e snapshots before/after/evidencia sao gravados na mesma transacao.
- Evidencias/seguranca: aprovacao, correcao e ocultacao exigem evidencias ligadas ao processo, com URL HTTPS em host exato de fonte ativa revisada. Correcoes aceitam apenas campos allowlisted, verificam IDs filhos no processo, normalizam chaves de curso/cota e ocultam dados alterados quando o processo estava publicado.
- Validacao: build + `corepack pnpm test` (176/176), `corepack pnpm test:e2e` (3/3; fila e quatro comandos administrativos retornam 401 sem token), lint, typecheck e format:check: PASS. Os testes cobrem stale 409 sem escrita, auditoria atomica, before/after, correcoes fora de escopo e evidencias por host.
- Pendencias: migration `20261108140000_process_review_version` criada e nao aplicada; adapter Prisma de comandos testado em memoria, sem PostgreSQL local. OpenAPI publico permanece sem rotas administrativas. Sem push, deploy ou migracao de producao.


## Passo 062 — concluído em `b4153ee`; ADR 0038 aceito

- Estado observado: backend limpo após passo 061 em `7e9ec7f`; frontend limpo em `fa0248e`. Relidos roteiro 062 e arquitetura §§ 4.2, 7.3 e 10.3; inspecionados Source, AllowedDomain, CrawlRun, filas BullMQ, scheduler, quotas Redis e guards ADMIN/CURATOR.
- Decisão do usuário: ADR 0038 aceito. Disparos manuais usam cooldown Redis atômico por host exato, compartilhado entre usuários/instâncias, padrão 60 s e configurável; 429 inclui `Retry-After`, e falhas Redis retornam 503.
- Implementação: rotas administrativas para listar fontes e domínios, obter saúde de fonte, cadastrar domínio sem coleta, registrar fonte DRAFT, revisar política do domínio, ativar/pausar/configurar fonte e solicitar execução manual. Apenas ADMIN altera allowlist/configuração; CURATOR/ADMIN podem ler e disparar. Ativação/disparo exigem instituição pública verificada, domínio exato revisado com coleta autorizada e fonte não BLOCKED. Mutações registram ator, motivo e before/after em AuditEvent; corrida entre coleta e revogação exige revalidação pelo consumidor.
- Saúde: detalhes incluem últimas CrawlRun, estado atual, quota de busca por host/dia UTC e jobs atrasados da fila `source.refresh`; sem horário exato confiável de retry, o campo `nextRetryAt` permanece nulo. O OpenAPI público é gerado só com módulos públicos e não inclui rotas administrativas.
- Validação: `prisma validate`, `corepack pnpm test` (180/180), `corepack pnpm test:e2e` (3/3), lint, typecheck, format:check, openapi:check e `git diff --check`: PASS. Testes cobrem papel ADMIN, revisão de domínio, ativação, auditoria, limite Redis e host exato; E2E verifica 401 nas rotas novas.
- Pendências: consumidor `source.refresh` ainda não está integrado à fila, portanto o endpoint confirma enfileiramento e não afirma execução concluída. Integração com PostgreSQL/Redis reais requer serviços de desenvolvimento; nenhuma migração ou deploy de produção, publicação ou push.

## Passo 063 — concluído localmente no frontend

- Estado observado: backend limpo em `b4153ee` e frontend limpo em `fa0248e` antes do passo. Relidos roteiro 063 e arquitetura §§ 7.3 e 9.1–9.4; examinados Angular, rotas, ambientes e a imagem `style-reference.png`.
- Implementação: `/admin/login`, `/admin/callback` e shell `/admin` com menu de revisões/fontes, estado de sessão, saída e guard de rota. Sem token, o guard redireciona para login com retorno interno validado. A API continua autorizando cada endpoint. O login usa OIDC Authorization Code com PKCE, client ID público, estado transitório em sessionStorage e token somente em memória. A configuração do provedor permanece nula até decisão operacional do ADR 0035.
- Estética: o shell emprega fundo marfim, preto dominante, título muito pesado, blocos lima/laranja/azul/lilás, bordas grossas, sombras deslocadas e formas anguladas da referência, com foco visível, semântica e layout responsivo. A inspeção por navegador local não ficou disponível (`browser access host is unavailable`); build e testes de componente validaram a estrutura.
- Evidência: frontend `5bf1342`; `corepack pnpm build`, `corepack pnpm test` (7/7), `corepack pnpm test:e2e` (1/1), lint, typecheck, format:check e `git diff --check`: PASS. Testes cobrem redirecionamento sem token, rotas de retorno restritas, provedor ausente e navegação rotulada.
- Pendências: provedor de identidade e client ID operacionais não configurados; telas reais de revisão e fontes vêm nos passos 064–065. Nenhum token, segredo, edital ou URL oficial foi publicado; sem push/deploy.

## Passo 064 — concluído localmente no frontend

- Estado observado: frontend limpo no commit `5bf1342` antes do passo; backend limpo em `df88c94`. Relidos roteiro 064 e arquitetura §§ 9.3, 9.4 e 10.3; inspecionados contratos reais da fila/detalhe e comandos administrativos, além da referência `style-reference.png`.
- Implementação: fila de revisão com filtros de estado, paginação e seleção de processo; painel lado a lado com fatos, ofertas/reservas, prazos, requisitos, trechos de evidência, páginas/seções, versão/hash/documento PDF, retificações e decisões anteriores. Correções tipadas enviam `expectedReviewVersion`, motivo e evidência por campo. Aprovação exige fonte selecionada e atestações de escopo/fatos críticos; registro histórico de demonstração não pode ser aprovado. Conflito 409 exige recarga explícita antes de nova decisão.
- Acessibilidade/estética: componentes responsivos, semântica e rótulos associados; tokens, cores, tipografia de cartaz, bordas, sombras e blocos gráficos alinhados à imagem de referência. Navegador CUA indisponível neste ambiente; estrutura verificada pelo Angular TestBed e build.
- Evidências: frontend `d925fbd`; `corepack pnpm test` (11/11), `corepack pnpm test:e2e` (1/1), build, lint, typecheck, format:check e `git diff --check`: PASS. Testes novos cobrem contexto de evidência, payload versionado, bloqueio de registro histórico e conflito 409.
- Pendências: configuração operacional do provedor OIDC ainda depende da decisão operacional ADR 0035; testes E2E com identidade/fluxo completo permanecem no passo 066. Nenhum push, deploy, publicação ou migração foi feito.

## Passo 065 — concluído localmente em frontend e backend

- Estado observado antes da implementação: frontend `d925fbd` e backend `a6c0ffb`, ambos limpos. Relidos roteiro 065 e arquitetura §§ 9.3, 9.4 e 10.3; conferidos `GET /admin/sources`, `GET /admin/sources/:id`, histórico CrawlRun, regras de permissão e imagem `style-reference.png`.
- Implementação frontend: dashboard mostra estado/status e última coleta por fonte, candidatas da fonte selecionada, últimas cinco execuções com HTTP/erro/tentativa, retentativa e contagens `waiting/active/delayed/failed` da fila. A UI esclarece que contagens BullMQ são compartilhadas e não atribuídas a uma fonte específica. Solicitação manual exige confirmação e motivo, e não afirma que o job foi executado; 429 mostra `Retry-After`.
- Implementação backend: detalhe administrativo retorna quantidade de URLs em estado CANDIDATE observadas pela fonte e contagens reais da fila `source.refresh`; sem dados inventados.
- Estética/acessibilidade: layout responsivo, estados rotulados, foco visível, tabela semântica, blocos de alto contraste, marfim/preto e acentos lima/azul/laranja/lilás da referência.
- Evidências: frontend `8b6ed8f`; `corepack pnpm test` (14/14), `test:e2e` (1/1), build, lint, typecheck, format:check e diff: PASS. Backend `corepack pnpm test` (180/180), build, lint, typecheck e format:check: PASS. Testes cobrem falhas observadas, candidatas/fila, bloqueio de fonte e motivo obrigatório.
- Pendências: navegador CUA indisponível para inspeção visual ao vivo; frontend verificado em TestBed/build. Não foi executada integração com Redis/PostgreSQL reais, nem push/deploy/migração.

## Passo 066 — concluído localmente no backend

- Estado observado: backend limpo em `0a50c05`; frontend limpo em `8b6ed8f`. Relidos roteiro 066 e arquitetura §§ 7.3, 8 e 10.3; revisados guards JWT/RBAC, controller administrativo, comandos versionados, fluxo de auditoria e detalhe público.
- Implementação de teste E2E: token RS256 assinado e JWKS sintético atravessam AuthenticationGuard e AdminAuthorizationGuard. Claim `ADMIN` do token não concede elevação: o mapeamento servidor issuer+subject autoriza somente CURATOR; usuário sem mapeamento recebe 403. Controller e serviços reais exercitam fluxo de correção/auditoria/publicação.
- Cenário: prazo parcial permanece indisponível no detalhe público e não pode ser aprovado com fato crítico pendente. Curador corrige `endTime` com evidência oficial sintética; versão antiga retorna 409. Aprovação da nova versão registra decisão e evidência na trilha e o detalhe público retorna status ABERTA. Nenhum edital ou URL real foi criado/publicado.
- Evidências: novo `test/e2e/admin/review-publication.test.mjs`; `corepack pnpm test` (180/180), `corepack pnpm test:e2e` (5/5), build, lint, typecheck, format:check, `openapi:check` e `git diff --check`: PASS.
- Limitações: o teste cobre guards, controller e serviços reais com persistência em memória e transporte JWKS sintético; não há `TEST_DATABASE_URL` para PostgreSQL E2E local e nenhuma migração foi aplicada. Testes existentes do frontend seguem cobrindo guard e componentes (14/14 unitários, 1/1 E2E), sem alteração neste passo. Sem push/deploy.

## Passo 067 — concluído localmente no frontend

- Estado observado: frontend limpo em `8b6ed8f` e backend limpo em `2dd1737` antes do passo. Relidos roteiro 067 e arquitetura §§ 8, 9 e 12; revisados tokens/estilos existentes e inspecionada `style-reference.png`.
- Implementação: tokens de cor, tipografia, spacing, largura, raio e sombra; utilitários de container/grid/stack/flow; componentes standalone para botão, campo de texto, badge neutra/status, skeleton, estado vazio, feedback e card. Sem biblioteca de UI adicional.
- Acessibilidade/responsividade: controles nativos com foco visível e tabulação, associação label/hint/erro/aria-invalid, estados `role=status/alert`, contraste dos estados, grid reduzido em telas menores e respeito a `prefers-reduced-motion`.
- Estética: paleta marfim/preto/lima/laranja/azul elétrico/lilás, títulos de peso alto, bordas marcadas, sombras deslocadas e blocos angulares conforme a referência.
- Evidências: frontend `4959031`; `corepack pnpm test` (18/18), `test:e2e` (1/1), build, lint, typecheck, format:check e `git diff --check`: PASS. Testes cobrem foco de botão, estado disabled, badge neutra, labels/descrições de campo e anúncios acessíveis.
- Pendências: primitives serão adotados pelas telas públicas a partir do passo 068; verificação por navegador permanece indisponível nesta sessão. Nenhum push/deploy.

## Passo 068 — concluído localmente no frontend

- Estado observado: frontend limpo em `4959031` e backend limpo em `2737b51` antes do passo. Relidos roteiro 068 e arquitetura §§ 8, 9.1–9.4 e 10.1; revisados shell Angular, rotas, design system e imagem `style-reference.png`.
- Implementação: shell público com wordmark, navegação principal, skip link e rodapé; landing com proposta de valor, ilustração vetorial/retícula de megafone, busca rápida, atalhos de processo e avisos de prevalência documental. Busca conserva texto em query `q` para `/oportunidades`. CTA e tiles levam à rota prevista, que por enquanto informa com clareza que esta instalação não tem processos verificados e que isso não significa ausência de oportunidades. Nenhum card/dado/link oficial foi inventado.
- Estética/acessibilidade: paleta e linguagem gráfica da referência, arte sem dependência externa, responsividade para mobile, links semânticos, rótulo de busca, skip link e foco visível.
- Evidências: `corepack pnpm test` (20/20), `test:e2e` (1/1, shell e rotas profundas), build sem avisos, lint, typecheck, format:check e `git diff --check`: PASS.
- Pendências: integração real de API/client pertence aos passos 069–70; navegação real por browser indisponível nesta sessão. Sem push/deploy/publicação.

## Passo 069 — concluído localmente no frontend

- Estado observado: frontend limpo em `8499719` e backend limpo em `5906732` antes do passo. Relidos roteiro 069 e arquitetura §§ 8, 9.3 e 12.1; inspecionados OpenAPI público, cliente Hey API existente, environments e serviços Angular.
- Implementação: `PublicCatalogService` tipado pelas operações e respostas geradas para busca/lista, detalhe, filtros e instituições; cliente configurado por `apiBaseUrl` com fallback same-origin. `PublicApiError` normaliza timeout, cancelamento, rede, 5xx e 4xx, preserva request ID quando disponível e não expõe mensagens internas de 5xx. Timeout padrão 8 s; serviços aceitam `AbortSignal`. Nenhuma cópia manual dos DTOs públicos.
- Contrato: `pnpm api:generate` não gerou diff; `contracts/public-v1.json` confere byte a byte com o OpenAPI do backend e `corepack pnpm openapi:check` passou.
- Evidências: `corepack pnpm test` (25/25), `test:e2e` (1/1), build, lint, typecheck, format:check e diff: PASS. Testes verificam URL/query, retorno tipado, normalização 503 sem segredo, timeout, cancelamento e rejeição de origem insegura.
- Pendências: não há URL de staging configurada neste ambiente; portanto validação com API real de staging permanece pendente. O E2E atual verifica o shell web, e serviços são testados com `fetch` controlado. Sem push/deploy.

## Passo 070 — concluído localmente no frontend

- Estado inicial: frontend limpo em `6232b4f` (ahead 7, sem alterações); backend limpo em `c00939e` (ahead 6, sem alterações).
- Arquitetura relida: §§ 8, 9.1 e 9.3–9.4. O passo exige listagem pública, paginação, estados de carregamento/erro/vazio e fonte oficial. O roteiro 070 exige resultados vindos integralmente de `GET /processes`.
- ADR 0039 aceito: o roteiro dizia `:slug`, mas o contrato existente só dispõe de UUID em `ProcessCard.id` e `GET /processes/:id`. O usuário escolheu `/oportunidades/:id`; nenhuma mudança de schema/OpenAPI. A página detalhada será implementada no passo 072.
- Implementação: rota `/oportunidades` usa client gerado; cards apenas dos resultados retornados pela API; paginação preserva `page` na querystring; skeleton, erro recuperável, estado vazio sem inventar oportunidades, status e verificação; links de detalhe por UUID e de edital com `noopener noreferrer`. Página inicial atualizada para descrever catálogo revisado.
- Commit frontend: `15330e4 feat(web): construir listagem de oportunidades`. Nenhum push.
- Verificações: `pnpm test` 30/30; `pnpm test:e2e` 1/1; `pnpm lint`, `pnpm typecheck`, `pnpm build` sem avisos, `pnpm format:check` e `git diff --check`: PASS.
- Pendências: implementar a rota/página de detalhe no passo 072. Validação contra staging não executada, sem endpoint de staging configurado.


## Passo 071 - concluido localmente no frontend

- Estado inicial: frontend limpo em `15330e4` (ahead 8); backend limpo em `ef85890` (ahead 7).
- Arquitetura relida: secoes 8, 9.1 e 9.3. A interface persiste consulta, UF, cidade, grau, modalidade, ENEM, tipo, inscricoes abertas, ordenacao e pagina na querystring.
- Implementacao: componente de filtros; busca textual com debounce de 300 ms; seletores de ENEM (inclui `unknown` para nao informado), abertas e ordenacao; campos para UF/cidade/grau/modalidade/tipo. A chave publica `type` mapeia para `selection_type` da API e aceita leitura do nome antigo. Mudanca de filtro zera pagina; historico recarrega filtros e resultados.
- Verificacoes: testes cobrem filtros, mapeamento, ENEM desconhecido e recarga por querystring/historico. `pnpm test` 33/33; `pnpm test:e2e` 1/1; `pnpm lint`, `pnpm typecheck`, `pnpm build` sem avisos, `pnpm format:check` e `git diff --check`: PASS.
- Commit frontend: `f159f1d feat(web): implementar filtros e query params`. Nenhum push.
- Pendencias: construir a pagina de detalhe no passo 072. Validacao com staging indisponivel sem URL configurada.


## Passo 072 - concluido localmente no frontend

- Estado inicial: frontend limpo em `f159f1d` (ahead 9); backend limpo em `57dfd9e` (ahead 8).
- Arquitetura relida: secoes 8, 9.1, 9.3 e 9.4; ADR 0039 estabelece `/oportunidades/:id` com UUID, mapeado para `GET /processes/:id`.
- Implementacao: rota e detalhe consultam apenas o contrato publico gerado. Exibem ofertas, reservas, campi verificados, janelas (data/hora/fuso sem completar valores ausentes), requisitos, evidencias, links oficiais e ultima verificacao. Campos ausentes ficam explicitos; 404 nao revela estado interno; detalhes nao afirmam elegibilidade. Links externos usam `noopener noreferrer`.
- Verificacoes: testes unitarios cobrem dados presentes/ausentes, ENEM desconhecido, 404 e troca de UUID. `pnpm test` 37/37; `pnpm test:e2e` 1/1 (inclui a rota UUID); `pnpm lint`, `pnpm typecheck`, `pnpm build` sem avisos, `pnpm format:check` e `git diff --check`: PASS.
- Commit frontend: `1a1b80b feat(web): desenvolver detalhes verificaveis`. Nenhum push.
- Pendencias: validar detalhe contra API real de staging quando houver URL configurada; seguir para diretorio de instituicoes no passo 073.


## Passo 076 — segurança da API — concluído localmente no backend

- Estado inicial observado: backend limpo em `dfcb831` antes do passo; frontend limpo em `f582494`. Relidos o checkpoint 076 e as seções 10.1, 10.2, 10.3 e 11.1 da arquitetura; examinados cliente HTTP responsável, validação de artefatos, autenticação/autorização, CORS, erros, limites de execução manual e testes existentes.
- Implementação: middleware instala CSP restritiva para respostas API, `nosniff`, frame denial, referrer e permissions policies; sem HSTS na API HTTP local. Redis atômico limita GETs públicos a 120/min por IP observado no socket e mutações administrativas a 30/min por `issuer+subject`; `X-Forwarded-For` é ignorado, excedentes retornam 429/`Retry-After` e Redis indisponível falha fechada em 503. Testes cobrem destinos privados, DNS rebinding, abuso, headers/CORS e rate limit. Threat model registra controles e lacunas; contrato OpenAPI público não mudou.
- ADR 0042: política aceita pelo usuário em 2026-11-11; janela fixa de 60 s, identidades em hash Redis, health/admin/internal excluídos do bucket público e cooldown de 60 s por host do ADR 0038 independente.
- Testes: `corepack pnpm test` 190/190; `corepack pnpm test:e2e` 5/5; `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm format:check`, build e `git diff --check`: PASS. E2E confirma health/CORS e rotas admin sem token; testes unitários exercitam Redis atômico, IP de socket, 429 e fail-closed.
- Pendências: trust proxy continua desativado até definir o ingress; configuração TLS/Redis/Postgres e isolamento de parsers dependem da infraestrutura. Nenhuma produção foi acessada; sem push, deploy ou migração.

- Commits locais do passo 076: `43fd661` hardening de HTTP/SSRF e `4455c0e` rate limit Redis conforme ADR 0042 aceito.

## Passo 077 — logs, métricas e alertas — concluído localmente no backend

- Estado inicial: backend `4455c0e` sem alterações rastreadas após fechamento do passo 076; frontend sem alterações neste passo. Relidos checkpoint 077 e arquitetura §11.2; examinados relações de CrawlRun/DiscoveryObservation/DiscoveredUrl/Document/Evidence, filas BullMQ, provider IA, auditoria e logs atuais.
- Implementação: logs JSON de request, worker, coleta, observação, snapshot, IA e decisão humana; IDs de request validados e reutilizados na auditoria; correlação por IDs persistidos e hash SHA-256 da URL sem imprimir URL, query, body, citação, segredo, IP ou identidade do usuário. Endpoint Prometheus `/api/v1/internal/metrics` exige CURATOR/ADMIN e fica fora do OpenAPI público; inclui request/review/IA, estado e idade de fonte, observações 24h, falhas, fila e jobs failed. Regras iniciais em `infra/monitoring/alerts.yml`; limiares de fonte seguem ADR 0023.
- Validação: `corepack pnpm test` 193/193; `corepack pnpm test:e2e` 5/5; build, lint, typecheck, format:check, `openapi:check` e `git diff --check`: PASS. E2E exercita API/admin, request ID, rota de métricas protegida, worker sem HTTP e replay offline.
- Limitações e pendências: consumidores BullMQ de fetch/extract ainda não estão conectados, portanto não há replay vivo URL→revisão; as chaves de proveniência no banco e logs estão correlacionadas para quando o fluxo for integrado. Contadores em memória reiniciam; uso de IA no worker é registrado em logs e não chega ao scrape da API até instalar collector compartilhado. Homologação ainda precisa configurar scrape privado, retenção, dashboards e destinos de notificação. Nenhuma produção foi acessada; sem push/deploy/migração.

## Passo 078 ? desempenho e or?amentos ? conclu?do localmente no backend

- Estado inicial: backend limpo em `6b6dbe8`; frontend limpo, sem escopo neste checkpoint. Relidos o passo 078 do roteiro e os requisitos de desempenho/consultas indexadas da arquitetura; inspecionados `PublicSearchService`, filtros/facetas, pagina??o, ?ndices Prisma, limites de IA e concorr?ncia do worker.
- Implementa??o: `test/performance/public-search.mjs` executa `EXPLAIN (ANALYZE, BUFFERS)`, semeia corpus exclusivamente sint?tico e mede a busca p?blica completa sob concorr?ncia. O harness recusa qualquer conex?o que n?o seja `localhost:5433/alem_perf`, aceita banco vazio ou os 2.000 registros de fixture e confirma resultados/pagina??o. Comando `pnpm perf:public-search`; banco j? deve estar migrado localmente.
- Carga e evid?ncia: Windows 11, AMD Ryzen 7 5700G, 8 n?cleos, 16 GiB RAM, PostgreSQL 18, Node 24; 5 institui??es sint?ticas, 2.000 processos/ofertas/revis?es, 30 aquecimentos, 200 amostras, concorr?ncia 8, p?gina 20. p50 166,78 ms, p95 237,74 ms, m?ximo 271,57 ms. Consulta representativa de elegibilidade: 1,40 ms, plano Hash Join, 77 blocos compartilhados. Resultado local abaixo do objetivo p95 <500 ms; n?o ? garantia de produ??o.
- Decis?o t?cnica por evid?ncia: n?o adicionar ?ndice ou cache sem benef?cio demonstrado nesta carga; a busca ainda hidrata e p?s-processa todo o cat?logo eleg?vel antes de paginar. Reavaliar em volume maior preservando host oficial exato, filtros e estados conservadores de prazo. Limites `page_size` e or?amento cumulativo de IA (zero desativa chamadas) s?o cobertos pelos testes existentes. Consumidores BullMQ ainda n?o conectados; sem carga de jobs/IA real.
- Testes/verifica??es: `pnpm perf:public-search` PASS; `pnpm test` 193/193; `pnpm test:e2e` 5/5; `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm openapi:check` e `git diff --check` PASS. O harness recusou host fora de loopback antes de conectar (teste de isolamento). Migrations foram executadas somente no PostgreSQL tempor?rio local; sem produ??o, push ou deploy.
- Pend?ncias: repetir com escala e hardware representativos antes de qualquer promessa de produ??o; medir filtros/facetas e cargas com cache frio; estabelecer limites de conex?es/lat?ncia em staging. Nenhuma mudan?a no frontend neste passo.

## Passo 079 — E2E offline; gate do pipeline integrado pendente

- Estado inicial: backend limpo em `b83cfd9`; frontend limpo em `f582494`. Relidos checkpoint 079 e arquitetura §§ 12.1–12.2; inspecionados worker, módulos, fixtures, revisão, API, Playwright e gates. Docker Engine/Compose está disponível no Ubuntu WSL; a biblioteca Testcontainers não está instalada e os consumers BullMQ de negócio ainda não conectam as etapas.
- Artefatos: `test/e2e/full-pipeline/run-offline.mjs` agrega as suítes backend, integração PostgreSQL/Redis opcional e Angular. `README.md` e `docs/quality/gates.md` separam evidência local dos critérios ainda pendentes.
- E2E: backend 5/5, integração completa PostgreSQL/Redis 25/25 em containers descartáveis e Playwright 4/4. O runner requer `TEST_DATABASE_URL` loopback terminada em `_e2e`/`_test` e `TEST_REDIS_URL` loopback; não migra nem semeia. Timeouts de boot passaram de 10 para 20 s e os testes aguardam a saída dos processos HTTP.
- Banco de teste: PostgreSQL 17.7 e Redis 7.4.12 em containers Docker locais, publicados apenas em loopback 5434/6381; migrations e seed local revisada aplicadas somente no banco descartável. Nenhuma chamada externa, produção ou dado real foi usado.
- Limite e estado: o passo 079 permanece parcial e G5 PENDENTE. As suítes ainda não compõem um único percurso: documento do replay não alimenta revisão e a jornada Angular usa API simulada. O consumer `source.refresh` foi implementado em `f044ebf`; `url.fetch` e `document.extract` ainda não têm consumers conectados, portanto não há prova do fluxo de ponta a ponta. Usuário autorizou seguir com E2E offline e registrar esse gate pendente.
- Próximas evidências: conectar `url.fetch` e `document.extract` com idempotência, manter candidatos invisíveis antes da aprovação, servir o processo aprovado pelo NestJS real e carregar a mesma resposta no Playwright sem mocks. G5 ainda exige staging, backup/restore, segurança/curadoria e aprovação explícita antes de produção. Sem push, deploy ou migração em produção.
- Revalidação agregada em 2026-11-12: `corepack pnpm test:e2e:offline` PASS, backend 5/5, PostgreSQL/Redis 25/25 e Playwright 4/4; `pnpm test` 193/193; lint, typecheck, format:check, openapi:check e `git diff --check` PASS. A suíte web é simulada e as suites não formam pipeline único.
- Implementação incremental do consumer `source.refresh`: valida fonte ACTIVE, domínio exato revisado e coleta autorizada; processa HTML/RSS/sitemap com HTTP responsável, registra URL globalmente com `crawlRunId` estável para retries/replay e enfileira candidatos sem visibilidade pública. Inclui testes focados para fonte não revisada, exclusão por âncora explícita e idempotência do run. Sem fetch/extract/publish conectados; fontes seguem sem ativação operacional.
- Revalidação em 2026-11-12: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (196/196), `pnpm test:e2e:offline` (backend 5/5; Angular Playwright 4/4) e `git diff --check` PASS. PostgreSQL/Redis de integração SKIPPED por `TEST_DATABASE_URL` ausente; o gate integrado unico permanece pendente. A primeira execução agregada falhou com encerramento nativo do `ng serve` (`-1073740791`); Playwright isolado e nova execução agregada passaram.

## Passo 080 — staging local isolado; homologação externa pendente

- Estado inicial: backend limpo em `73e0a3f`; frontend limpo em `f582494`. Lidos o checkpoint 080 e arquitetura §§ 11–11.2; examinados Compose de desenvolvimento, containers Docker/WSL, configuração Angular/API, migrations, secrets, storage e ADRs 0008/0041.
- ADR 0043 registra a pendência do provedor, domínio, serviços gerenciados, vault e política de storage. A escolha não pode ser inferida dos repositórios; não foi criado domínio, endpoint ou credencial.
- Decisão preservada: ADR 0043 mantém sem escolha o provedor, domínio, serviços gerenciados, vault e storage oficial. Compose local loopback é uma camada executável de ensaio; não é homologação externa.
- Artefatos: `infra/staging/compose.yml`, `Dockerfile.staging`, `.dockerignore`, scripts PowerShell de start/stop, `infra/staging/.env.example` e `.gitignore`; Angular CSR usa API real local e catálogo vazio. Segredos não são versionados; Postgres/Redis não publicam portas no host; AI/OCR/busca têm orçamento zero; migrations continuam manuais.
- Testes locais: build Docker de API/worker/web PASS; 16 migrations aplicadas apenas no volume local `alem_staging`; `/ready`, `/api/v1/processes`, `/api/v1/filters`, `/api/v1/institutions` e `/oportunidades` responderam HTTP 200; catálogo e instituições ficaram vazios sem seed inventada. Playwright contra API real, sem mocks, 1/1 PASS. Scripts `start.ps1` e `stop.ps1` exercitados; stack encerrada sem remover volumes. Frontend: format, lint, typecheck, 47 testes, build e Playwright 4/4 PASS. Backend: format, lint, typecheck, 193 testes e offline E2E 5/5 PASS; integração DB/Redis não executada nesta repetição por ausência de `TEST_DATABASE_URL`.
- Resultado: passo parcial. Sem deploy externo ou E2E em domínio real; sem backup/restore gerenciado, storage oficial ou fluxo E2E de negócio integrado. Gates dependentes dos ADRs 0008/0043 e do passo 079 continuam pendentes. Nenhuma migration de produção, push ou deploy.

## Passo 081 — ensaio local de backup, restore e migrations

- Estado inicial: backend limpo em `c130457`; arquitetura §11 e §11.1 e checkpoint 081 lidos; revisados `docs/ops/migrations.md`, política ADR 0008, schema dos documentos/blobs e serviços Docker temporários.
- Executado backup PostgreSQL custom-format no banco local descartável `alem_test`, listagem do archive, restore para novo banco `alem_restore_test`, consulta de 16 migrations concluídas e comparação de `documents.sha256`/`document_blobs.sha256`.
- Fixture não real: um documento e blob sintéticos com hash `17a403a6fd00d9944c0b71633fac55bcee6095376365d92c27bb662855f10121`; o mesmo hash e contagem 1/1 foram observados na origem e no restore. Checksum SHA-256 do arquivo: `43e7256d9f601ef439cd07a21c21d3f0f8597ad175f23c865c1faab3aef8d2ae`.
- Artefatos: `docs/ops/backup-restore.md` e atualização de `docs/ops/migrations.md`. O roteiro define backup fora do Git, controle de retenção, restore isolado e proibição de operações de produção sem autorização.
- Reensaio após o passo 080: o banco vazio do Compose local foi exportado em formato custom, o inventário `pg_restore --list` apresentou 178 entradas e o restore isolado `alem_staging_restore_test` preservou 16 migrations concluídas, zero documentos e zero blobs. Contagens e hashes ordenados foram comparados; banco e arquivo temporários removidos, volumes preservados. Evidência e SHA-256 em `docs/ops/backup-restore.md`.
- Pendência: ensaio remoto em homologação, backup automatizado gerenciado e política de retenção/restore exigem o provedor do passo 080. Nenhuma migration de produção, push ou deploy.

## Passo 082 — auditoria do piloto de fontes/corpus — parcial

- Estado inicial: backend limpo em `09e1fd9`; frontend limpo em `f582494`. Relidos checkpoint 082 e arquitetura §§ 4.1–4.3, 5.1–5.2, 10.1 e 11.2; examinados matrix, corpus, ADR 0030 e política de coleta.
- `py test/fixtures/institutions/validate_golden_dataset.py` PASS: 35 artefatos em quatro instituições; 29 `IN_SCOPE`, 3 `OUT_OF_SCOPE`, 3 `PENDING_REVIEW`; ENEM 12/15/8 (true/false/unknown); oito revisões parciais. Taxa de inscrição não tem campo no dataset; não há precisão/recall real sem curadoria de títulos/trechos.
- Índices UFPB, UFCG e IFPB foram lidos; tentativa de leitura UEPB retornou 502 do serviço de navegação, não prova falha da origem. Matriz preserva status HTTP/robots da última checagem direta e registra o resultado observacional de 2026-11-12. Nenhum novo edital foi incluído.
- Sem fetch automatizado, snapshots, consulta paga ou IA; custo variável externo desta auditoria = zero. Conectores seguem DRAFT; revisão humana/licença/retensão bloqueiam automação e publicação.
- Releitura adicional de índices oficiais em 2026-11-11 local: UFPB, UFCG e IFPB renderizaram conteúdo; UEPB voltou a falhar com 502 no leitor. Apenas listagens foram lidas; nenhum edital baixado ou incluído. `robots.txt` não foi revalidado por ferramenta direta, preservando datas antigas da matriz. Observações e limites registrados em `source-matrix.csv` e `pilot-report.md`; todos os conectores continuam desativados.
- Artefato `docs/quality/pilot-report.md`; pendências incluem confirmação direta UEPB, termos/retensão, curadoria de evidências textuais e dados de taxa. Metas de precisão/recall do piloto e cobertura completa permanecem não medidas.

## Passo 083 — pipeline de release e rollback — pendente de staging

- Estado inicial: backend limpo em `5e7e170`; frontend limpo em `f582494`. Relidos checkpoint 083 e arquitetura §§ 10.3, 11–11.1; conferidos os dois workflows CI, documentação Git e remotes.
- Remotes de código existem, mas não têm push autorizado e a configuração/proteção hospedada, provedor, ambientes, domínio, secrets e staging não estão disponíveis para revisão. Os workflows CI apenas validam qualidade e não fazem deploy.
- ADR 0044 mantém jobs reais de release pendentes para não criar workflow sem destino. `docs/ops/rollback.md` registra reversão de artefato, compatibilidade de schema, backup, gates manuais e proibição de force push.
- Reavaliação depois do passo 080: Compose e start/stop locais passaram, mas não verificam domínio, TLS, permissions/rulesets remotos, deploy externo ou rollback de artefato. `.github/workflows/` contém apenas `ci.yml`; release workflow continua ausente por decisão do ADR 0044.
- Validação de deploy/rollback e permissões remotas não executável sem hosting/ambiente. Remotes permanecem sem push. Passo parcial; sem push, deploy ou migration.

## Passo 084 — avaliação da release 1.0 — retida

- Estado inicial: backend limpo em `c32000d`; frontend limpo em `f582494`. Lidos checkpoint 084 e arquitetura §§ 10.2, 10.3, 11–11.2 e 12.2; inspecionados flags/URLs Angular, E2E mocks, conectores, API, progress e gates.
- Evidências contrárias à publicação: `catalogEnabled=false`, `apiBaseUrl`/`publicSiteUrl` vazios em produção; nenhuma fonte ativa/processo aprovado; consumers não fecham o fluxo único; sem homologação externa, rollback ensaiado, host ou revisão real de acessibilidade. Há teste browser→API real em staging local vazio, além do Playwright mockado. A arquitetura exige fonte oficial e revisão humana; nenhum dado foi publicado.
- Artefatos: `docs/releases/v1.0-mvp.md` registra checklist e decisão RETIDA; `docs/ops/runbook.md` cobre preview e Compose local; `docs/legal/privacy-terms-draft.md` é explicitamente rascunho interno e não pode entrar em publicação; `docs/quality/gates.md` aponta G5 pendente.
- Validação: `corepack pnpm test:e2e:offline` passou após limpar do banco descartável o documento/blob sintéticos usados no ensaio 081: backend 5/5, PostgreSQL/Redis 25/25 e Playwright 4/4. A tentativa anterior ficou 24/25 por resíduo da fixture e não foi ocultada; repetição limpa passou. O runner segue com suítes independentes e API mockada no browser.
- Evidências novas: staging local construiu web/API/worker, aplicou 16 migrations manualmente e validou browser→API real 1/1 com catálogo vazio; backup/restore local comparou 16 migrations e hashes; nova auditoria leu somente índices oficiais e não adicionou editais. Esses ensaios não conectam descoberta, revisão e publicação.
- Fechamento documental: `corepack pnpm test:e2e:offline` reexecutado com TEST_DATABASE_URL/TEST_REDIS_URL vazios — backend 5/5 e Playwright simulado 4/4 passaram; integração DB/Redis ficou explicitamente SKIPPED. Compose/API real 1/1 e corpus 35/35 também passaram nesta rodada; `git diff --check` limpo.
- Resultado: passo 084 alcançado como avaliação de release, não como publicação do MVP. G5 PENDENTE. P0 não está pronto para produção; P1/P2 não iniciados. Sem tag de release, push, deploy ou migration.
