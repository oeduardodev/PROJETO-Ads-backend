# Gates de qualidade e liberação

Os gates organizam o MVP P0 e suas expansões. Evidência de código local não equivale a staging ou aprovação de produção. P1 (G6) e P2 (G7) só começam após os gates precedentes e não fazem parte do MVP deste roteiro.

| Gate | Critério do roteiro | Evidência registrada | Estado |
| --- | --- | --- | --- |
| G0 — Pesquisa | Quatro instituições, corpus revisado, escopo e ADRs | `docs/implementation/PROGRESS.md`, passo 005: 35 artefatos e quatro instituições, com exceções preservadas | Aprovado para fundação local |
| G1 — Plataforma | Build/testes, schema local, API documentada, shell e seed | `docs/implementation/PROGRESS.md`, passo 029: migrations e seed apenas em PostgreSQL local; API/UI verificadas | PASS local |
| G2 — Ingestão | Fontes e replay fixture até documento extraído | `test/e2e/ingestion.test.mjs` verifica fetch offline, snapshot, parser, hash/cache e falhas. Consumidores de fila não conectam as etapas | Evidência parcial; integração pendente |
| G3 — Curadoria | Extração estruturada, validação/evidência, permissão e publicação auditada | `test/e2e/admin/review-publication.test.mjs` valida revisão/correção/aprovação com evidência, audit log e detalhe público, usando repositórios em memória | Verificado offline; banco integrado pendente |
| G4 — UX pública | Busca/detalhe, filtros e acessibilidade | Playwright cobre as jornadas públicas com API simulada; revisão manual de leitor de tela segue pendente em `../../frontend/docs/quality/a11y.md` | Código local; revisão manual pendente |
| G5 — MVP publicado | Fluxo E2E, QA, staging, backup, segurança, curadoria e produção aprovada | Passo 079: backend E2E 5/5, integração PostgreSQL/Redis 25/25 e Playwright 4/4 em containers locais; as suítes são independentes e o browser usa API simulada. Consumidores BullMQ de negócio ainda não conectam discovery/fetch/extract. Sem staging ou autorização de produção | Pendente; não declarar MVP publicado |

A avaliação final do passo 084 está em `docs/releases/v1.0-mvp.md` e reteve a release. O rascunho interno de aviso/termos em `docs/legal/privacy-terms-draft.md` não está pronto para publicação; o runbook local em `docs/ops/runbook.md` não descreve uma operação de produção.

O comando `corepack pnpm test:e2e:offline` agrega as suítes offline disponíveis. Seu resultado é evidência de componentes/jornadas, não substitui os critérios ausentes da coluna G5. Qualquer revisão ou liberação deve revalidar todos os gates anteriores. Sem aprovação explícita, não fazer push, deploy ou migration de produção.
