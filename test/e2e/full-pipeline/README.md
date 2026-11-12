# E2E offline disponível

Execute `corepack pnpm test:e2e:offline` na raiz do backend para rodar, em sequência, os testes E2E offline do backend, a suíte completa de integração PostgreSQL/Redis e as jornadas Playwright do Angular. A fase PostgreSQL/Redis é opcional, mas exige `TEST_DATABASE_URL` em loopback com database terminado em `_e2e` ou `_test` e `TEST_REDIS_URL` para Redis local; migrations e seed local já devem estar aplicadas. O runner não migra nem semeia o banco.

O backend cobre inicialização isolada, replay de HTML/PDF em transporte fixture (snapshot, parser, hash/cache e falhas) e revisão/publicação com token/JWKS e persistência em memória. O Playwright cobre catálogo, filtros, detalhe, diretório e acessibilidade usando respostas HTTP simuladas. Nenhum teste acessa edital real, provedor pago ou rede externa para buscar conteúdo.

## Limite deste checkpoint

As suítes ainda são independentes: o documento criado no replay de ingestão não alimenta a revisão e a resposta mostrada pelo Angular não vem da API NestJS daquele mesmo processo. O worker não tem consumidores BullMQ de descoberta/fetch/extract conectados. Docker Engine/Compose via WSL e serviços PostgreSQL/Redis em containers estão disponíveis e foram usados nos testes; a biblioteca Testcontainers não está instalada no workspace. Por isso este comando é uma verificação offline útil, mas não fecha o fluxo único `source → discovery → document → extraction → review → publication → API → Angular` do passo 079 nem o gate G5. Não tratar verde aqui como evidência de pipeline integrado.

O runtime PostgreSQL/Redis local está disponível e coberto acima. Para fechar o gate, ainda são necessários handlers de produção ligados ao pipeline, fixture sintética revisada e aprovada por curador, consulta do mesmo registro pelo endpoint real e browser sem mocks; o estado anterior à aprovação deve permanecer invisível no catálogo.

Em 2026-11-12, o comando agregado foi executado com fixtures e containers Docker locais: backend E2E 5/5, integração PostgreSQL/Redis 25/25 e Playwright 4/4. Nenhuma consulta de edital real, chamada paga ou migração externa ocorreu. O runtime Docker está disponível via WSL; o pacote Testcontainers não está instalado no workspace.
