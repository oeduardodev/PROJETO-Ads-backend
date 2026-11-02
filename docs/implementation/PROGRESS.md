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
| Passo | 003 — `docs(sources): mapear fontes oficiais do piloto` |
| Estado | DONE: fontes oficiais mapeadas, acesso observado e pendências de automação registradas |
| Data | 2026-11-02 (America/Sao_Paulo) |
| Arquitetura consultada | Documento completo; para o passo 003, §§ 4, 10.1, 13 e 15 |
| Roteiro consultado | Documento completo; passo 003 e contrato Git da seção 2 |
| Commit anterior | `c9f04ddb9cf560cc10f20af92b3080208247fc22` — passo 002, backend local |
| Commit atual | `HEAD` do backend após o commit `docs(sources): mapear fontes oficiais do piloto` (consultar `git log -1 --format=%H`; sem push) |
| Próximo passo | 004 — montar corpus rotulado de 30–50 documentos oficiais; gate G0 só após 005 e revisão |

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

## Pendências e decisões

### Decisão de topologia dos repositórios (ADR 0000)

**Contexto.** A arquitetura (§ 7.1) descreve um monorepo lógico e o roteiro prevê iniciar um monorepo pnpm no passo 006. Foram fornecidos dois repositórios GitHub separados, ambos vazios. O workspace local tem as pastas `frontend/` e `backend/` vazias e documentos na raiz.

**Decisão do usuário.** Manter frontend e backend como repositórios Git separados. Os documentos de arquitetura, o roteiro e este registro de progresso ficam no backend como fonte de referência para ambos. Cada passo gera no máximo um commit no repositório pertinente; se um passo futuro exigir alterações atômicas nos dois, registrar a exceção e os dois SHAs no progresso antes de prosseguir.

**Consequência.** O monorepo pnpm sugerido no roteiro será adaptado para dois projetos e CI independentes; contratos entre API e Angular terão versionamento explícito. Justificativa, alternativas e impacto estão registrados no ADR 0000 antes da fundação.

### Outras pendências

- Passos 004–005 e gate G0: formar corpus de 30–50 documentos oficiais rotulados e validar métricas/decisões antes de instalar dependências. Não tratar a matriz de fontes como aprovação de crawling.
- Referência visual: imagem inspecionada. Linguagem de cartaz/colagem: fundo marfim, preto dominante, tipografia sans extremamente pesada nos títulos, blocos verde limão, laranja intenso, azul elétrico e lilás, contornos pretos espessos, sombras deslocadas, cantos e formas oblíquas, raios e setas desenhadas, fotos em meio-tom, busca larga e cards com imagem institucional. Extrair tokens e componentes no passo 067 e aplicar na interface pública no passo 068, com equivalentes responsivos/acessíveis e sem apresentar oportunidades fictícias como vigentes.
