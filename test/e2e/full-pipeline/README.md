# E2E offline disponível

Execute `corepack pnpm test:e2e:offline` na raiz do backend para rodar, em sequência, os testes E2E offline do backend, a suíte completa de integração PostgreSQL/Redis e as jornadas Playwright do Angular. A fase PostgreSQL/Redis é opcional, mas exige `TEST_DATABASE_URL` em loopback com database terminado em `_e2e` ou `_test` e `TEST_REDIS_URL` para Redis local; migrations e seed local já devem estar aplicadas. O runner não migra nem semeia o banco.

O backend cobre inicialização isolada, replay de HTML/PDF em transporte fixture (snapshot, parser, hash/cache e falhas), encadeamento BullMQ de classificação/extração e revisão por serviço com persistência PostgreSQL/Redis. No replay de fixture, o mesmo artefato chega à fila administrativa e uma ação explícita de curador cria um rascunho privado auditado. O Playwright cobre catálogo, filtros, detalhe, diretório e acessibilidade usando respostas HTTP simuladas. Nenhum teste acessa edital real, provedor pago ou rede externa para buscar conteúdo.

## Limite deste checkpoint

O replay de fixture percorre até a fila e a criação humana de rascunho, mas as suítes Playwright continuam usando respostas simuladas e não consomem a API NestJS do mesmo registro. url.fetch grava somente fixtures em domínios reservados e modo de teste. Fora de teste, bytes oficiais ficam bloqueados até aprovação de storage/retenção (ADR 0008); os resultados de classificação/extração continuam conservadores e PENDING_REVIEW. Docker Engine/Compose via WSL e serviços PostgreSQL/Redis em containers estão disponíveis e foram usados nos testes; a biblioteca Testcontainers não está instalada no workspace. Portanto, este comando valida um segmento integrado do pipeline, mas não fecha o fluxo único source → discovery → document → extraction → review → publication → API → Angular nem o gate G5.

O runtime PostgreSQL/Redis local está disponível e coberto acima. Para fechar o gate, ainda são necessários uma fixture sintética revisada e aprovada por curador, consulta do mesmo registro aprovado pelo endpoint real e browser sem mocks, além de staging externo; o estado anterior à aprovação deve permanecer invisível no catálogo.

Em 2026-11-11 (America/Sao_Paulo), o comando agregado foi executado com fixtures e containers Docker locais: backend E2E 5/5, integração PostgreSQL/Redis 25/25 e Playwright 4/4. Nenhuma consulta de edital real, chamada paga ou migração externa ocorreu. O runtime Docker está disponível via WSL; o pacote Testcontainers não está instalado no workspace.
