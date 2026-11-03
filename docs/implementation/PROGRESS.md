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
| Fase | F01 — fundação do workspace e engenharia |
| Passo | 013 — `docs(dev): publicar setup reproduzível` |
| Estado | DONE local: README reproduziu Compose, API, worker e web; remotos continuam vazios sem push |
| Data | 2026-11-02 (America/Sao_Paulo) |
| Arquitetura consultada | Documento completo; para o passo 013, §§ 3, 7, 9 e 11–11.1 |
| Roteiro consultado | Documento completo; passo 013 e reprodução do ambiente somente com o README |
| Commit anterior backend | `9b128561ad51352dd743f3e1ab29dffc518cf8b7` — passo 012 |
| Commit frontend | `b426b7f5a95e76d123322e2e6a3a00ae0d54054f` — primeiro commit coordenado do passo 013 |
| Commit atual backend | `HEAD` após o commit documental do passo 013 (consultar `git log -1 --format=%H`; sem push) |
| Próximo passo | 014 — spike e ADR do ORM antes da primeira migration local |

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

## Pendências e decisões

### Decisão de topologia dos repositórios (ADR 0000)

**Contexto.** A arquitetura (§ 7.1) descreve um monorepo lógico e o roteiro prevê iniciar um monorepo pnpm no passo 006. Foram fornecidos dois repositórios GitHub separados, ambos vazios. O workspace local tem as pastas `frontend/` e `backend/` vazias e documentos na raiz.

**Decisão do usuário.** Manter frontend e backend como repositórios Git separados. Os documentos de arquitetura, o roteiro e este registro de progresso ficam no backend como fonte de referência para ambos. Cada passo gera no máximo um commit no repositório pertinente; se um passo futuro exigir alterações atômicas nos dois, registrar a exceção e os dois SHAs no progresso antes de prosseguir.

**Consequência.** O monorepo pnpm sugerido no roteiro será adaptado para dois projetos e CI independentes; contratos entre API e Angular terão versionamento explícito. Justificativa, alternativas e impacto estão registrados no ADR 0000 antes da fundação.

### Outras pendências

- Após G0: iniciar dependências e fundação somente nos passos 006–013. Não tratar a matriz de fontes como aprovação de crawling. Restrições de acesso, licença e retenção serão resolvidas por fonte antes de automatizar a coleta.
- Referência visual: imagem inspecionada. Linguagem de cartaz/colagem: fundo marfim, preto dominante, tipografia sans extremamente pesada nos títulos, blocos verde limão, laranja intenso, azul elétrico e lilás, contornos pretos espessos, sombras deslocadas, cantos e formas oblíquas, raios e setas desenhadas, fotos em meio-tom, busca larga e cards com imagem institucional. Extrair tokens e componentes no passo 067 e aplicar na interface pública no passo 068, com equivalentes responsivos/acessíveis e sem apresentar oportunidades fictícias como vigentes.
