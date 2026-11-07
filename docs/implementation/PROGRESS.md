# Progresso da implementação — Além do SiSU

## Contrato de execução

- `docs/reference/arquitetura_planejamento_editais_graduacao.docx` governa arquitetura, escopo e requisitos.
- `docs/reference/ordem_implementacao_commits_alem_do_sisu_codex.docx` governa sequência, testes e checkpoints. Divergências e escolhas técnicas em aberto exigem ADR antes de implementação.
- Cada passo deve ser examinado e validado isoladamente. Antes de um commit, registrar ID, seções da arquitetura consultadas, estado do repositório, escopo, comandos e resultados. Usar Conventional Commits somente com validação verde e repositório Git apto.
- Não fazer push, deploy ou migração em produção sem autorização explícita. Não publicar editais, links ou dados sem fonte oficial e revisão humana.
- Gates G0–G5 controlam o MVP P0; G6 controla P1; G7 controla P2. Nenhuma fase posterior está aprovada por antecipação.
- A imagem `style-reference.png` na raiz é a referência estética para as etapas de interface, preservadas as regras de acessibilidade e de dados verificáveis.

## Estado atual

| Campo | Valor |
| --- | --- |
| Fase | F05 — Documentos, parsing e evidências |
| Passo | 044 — `feat(documents): adicionar OCR como fallback sob demanda` |
| Estado | Passo 043 concluído em `700bec3`; passo 044 aguarda decisão do ADR 0025 |
| Data | 2026-11-05 (America/Sao_Paulo) |
| Arquitetura consultada | Passo 044: §§ 5.2, 7.2 e 10.1 |
| Roteiro consultado | Passo 044; checkpoint G1 concluído no passo 029 |
| Commit anterior backend | `700bec3` — passo 043 |
| Commit frontend | `fa0248e555074b3fd322a69048ada63642a7f293` — passo 029; sem alterações em 030–044 |
| Commit atual backend | `700bec3` — passo 043; sem push |
| Gate G1 | PASS local no passo 029; schema local segue atualizado |
| Próximo passo | 044 — decidir ADR 0025 antes de implementar OCR |

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

## Pendências e decisões

### Decisão de topologia dos repositórios (ADR 0000)

**Contexto.** A arquitetura (§ 7.1) descreve um monorepo lógico e o roteiro prevê iniciar um monorepo pnpm no passo 006. Foram fornecidos dois repositórios GitHub separados, ambos vazios. O workspace local tem as pastas `frontend/` e `backend/` vazias e documentos na raiz.

**Decisão do usuário.** Manter frontend e backend como repositórios Git separados. Os documentos de arquitetura, o roteiro e este registro de progresso ficam no backend como fonte de referência para ambos. Cada passo gera no máximo um commit no repositório pertinente; se um passo futuro exigir alterações atômicas nos dois, registrar a exceção e os dois SHAs no progresso antes de prosseguir.

**Consequência.** O monorepo pnpm sugerido no roteiro será adaptado para dois projetos e CI independentes; contratos entre API e Angular terão versionamento explícito. Justificativa, alternativas e impacto estão registrados no ADR 0000 antes da fundação.

### Outras pendências

- Após G0: iniciar dependências e fundação somente nos passos 006–013. Não tratar a matriz de fontes como aprovação de crawling. Restrições de acesso, licença e retenção serão resolvidas por fonte antes de automatizar a coleta.
- Referência visual: imagem inspecionada. Linguagem de cartaz/colagem: fundo marfim, preto dominante, tipografia sans extremamente pesada nos títulos, blocos verde limão, laranja intenso, azul elétrico e lilás, contornos pretos espessos, sombras deslocadas, cantos e formas oblíquas, raios e setas desenhadas, fotos em meio-tom, busca larga e cards com imagem institucional. Extrair tokens e componentes no passo 067 e aplicar na interface pública no passo 068, com equivalentes responsivos/acessíveis e sem apresentar oportunidades fictícias como vigentes.
