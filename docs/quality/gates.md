# Gates de qualidade e liberação

Os gates organizam o MVP P0 e suas expansões. Evidência de código local não equivale a staging ou aprovação de produção. P1 (G6) e P2 (G7) só começam após os gates precedentes e não fazem parte do MVP deste roteiro.

| Gate | Critério do roteiro | Evidência registrada | Estado |
| --- | --- | --- | --- |
| G0 — Pesquisa | Quatro instituições, corpus revisado, escopo e ADRs | `docs/implementation/PROGRESS.md`, passo 005: 35 artefatos e quatro instituições, com exceções preservadas | Aprovado para fundação local |
| G1 — Plataforma | Build/testes, schema local, API documentada, shell e seed | `docs/implementation/PROGRESS.md`, passo 029: migrations e seed apenas em PostgreSQL local; API/UI verificadas | PASS local |
| G2 — Ingestão | Fontes e replay fixture até documento extraído | `test/e2e/ingestion.test.mjs` verifica fetch offline, snapshot, parser, hash/cache e falhas. O consumer `source.refresh` está conectado; `url.fetch` e `document.extract` ainda não conectam descoberta a documento extraído | Evidência parcial; integração pendente |
| G3 — Curadoria | Extração estruturada, validação/evidência, permissão e publicação auditada | `test/e2e/admin/review-publication.test.mjs` valida revisão/correção/aprovação com evidência, audit log e detalhe público, usando repositórios em memória | Verificado offline; banco integrado pendente |
| G4 — UX pública | Busca/detalhe, filtros e acessibilidade | Playwright cobre as jornadas públicas com API simulada; revisão manual de leitor de tela segue pendente em `../../frontend/docs/quality/a11y.md` | Código local; revisão manual pendente |
| G5 — MVP publicado | Fluxo E2E, QA, staging, backup, segurança, curadoria e produção aprovada | Passos 079/080: E2E offline e staging local Compose com browser→API real/catálogo vazio passaram; as suítes de negócio seguem desconectadas: existe consumer BullMQ de `source.refresh`, mas faltam consumers `url.fetch`/`document.extract` e o percurso integrado; também faltam domínio/staging externo, storage/retenção oficial, restore gerenciado ou fontes/processos aprovados. | Pendente; não declarar MVP publicado |

A avaliação final do passo 084 está em `docs/releases/v1.0-mvp.md` e reteve a release. O rascunho interno de aviso/termos em `docs/legal/privacy-terms-draft.md` não está pronto para publicação; o runbook local em `docs/ops/runbook.md` não descreve uma operação de produção.

O comando `corepack pnpm test:e2e:offline` agrega as suítes offline disponíveis. O Compose em `infra/staging/` valida containers locais e uma navegação browser→API sem mocks, mas catálogo vazio não demonstra integração da descoberta, curadoria e publicação. Estas evidências não substituem os critérios ausentes da coluna G5. Qualquer revisão ou liberação deve revalidar todos os gates anteriores. Sem aprovação explícita, não fazer push, deploy ou migration de produção.
