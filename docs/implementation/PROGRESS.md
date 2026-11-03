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
| Fase | F00 — contrato, escopo e pesquisa |
| Passo | 005 — `docs(contract): definir glossário, estados e métricas` |
| Estado | DONE: contrato de domínio documentado e gate G0 aprovado para fundação local |
| Data | 2026-11-02 (America/Sao_Paulo) |
| Arquitetura consultada | Documento completo; para o passo 005, §§ 2.2, 5.4, 6.2, 9.3, 12, 13 e 14 |
| Roteiro consultado | Documento completo; passo 005 e gate G0 |
| Commit anterior | `abc9b2c` — passo 004, backend local |
| Commit atual | `HEAD` do backend após o commit do passo 005 (consultar `git log -1 --format=%H`; sem push) |
| Próximo passo | 006 — fundação dos dois repositórios pnpm conforme ADR 0000 |

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

## Pendências e decisões

### Decisão de topologia dos repositórios (ADR 0000)

**Contexto.** A arquitetura (§ 7.1) descreve um monorepo lógico e o roteiro prevê iniciar um monorepo pnpm no passo 006. Foram fornecidos dois repositórios GitHub separados, ambos vazios. O workspace local tem as pastas `frontend/` e `backend/` vazias e documentos na raiz.

**Decisão do usuário.** Manter frontend e backend como repositórios Git separados. Os documentos de arquitetura, o roteiro e este registro de progresso ficam no backend como fonte de referência para ambos. Cada passo gera no máximo um commit no repositório pertinente; se um passo futuro exigir alterações atômicas nos dois, registrar a exceção e os dois SHAs no progresso antes de prosseguir.

**Consequência.** O monorepo pnpm sugerido no roteiro será adaptado para dois projetos e CI independentes; contratos entre API e Angular terão versionamento explícito. Justificativa, alternativas e impacto estão registrados no ADR 0000 antes da fundação.

### Outras pendências

- Após G0: iniciar dependências e fundação somente nos passos 006–013. Não tratar a matriz de fontes como aprovação de crawling. Restrições de acesso, licença e retenção serão resolvidas por fonte antes de automatizar a coleta.
- Referência visual: imagem inspecionada. Linguagem de cartaz/colagem: fundo marfim, preto dominante, tipografia sans extremamente pesada nos títulos, blocos verde limão, laranja intenso, azul elétrico e lilás, contornos pretos espessos, sombras deslocadas, cantos e formas oblíquas, raios e setas desenhadas, fotos em meio-tom, busca larga e cards com imagem institucional. Extrair tokens e componentes no passo 067 e aplicar na interface pública no passo 068, com equivalentes responsivos/acessíveis e sem apresentar oportunidades fictícias como vigentes.
