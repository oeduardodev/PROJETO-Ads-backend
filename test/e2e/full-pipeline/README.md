# E2E offline disponível

Execute `corepack pnpm test:e2e:offline` na raiz do backend para rodar, em sequência, os testes E2E offline do backend e as jornadas Playwright do Angular. Com `TEST_DATABASE_URL` opcional, o runner inclui seis arquivos de integração de repositório; a URL deve usar loopback e database terminado em `_e2e` ou `_test`, com migrations e seed local já aplicadas. O runner não migra nem semeia o banco.

O backend cobre inicialização isolada, replay de HTML/PDF em transporte fixture (snapshot, parser, hash/cache e falhas) e revisão/publicação com token/JWKS e persistência em memória. O Playwright cobre catálogo, filtros, detalhe, diretório e acessibilidade usando respostas HTTP simuladas. Nenhum teste acessa edital real, provedor pago ou rede externa para buscar conteúdo.

## Limite deste checkpoint

As suítes ainda são independentes: o documento criado no replay de ingestão não alimenta a revisão e a resposta mostrada pelo Angular não vem da API NestJS daquele mesmo processo. O worker não tem consumidores BullMQ de descoberta/fetch/extract conectados. Docker/Testcontainers e Redis não estão disponíveis neste ambiente. Por isso este comando é uma verificação offline útil, mas não fecha o fluxo único `source → discovery → document → extraction → review → publication → API → Angular` do passo 079 nem o gate G5. Não tratar verde aqui como evidência de pipeline integrado.

Quando o runtime estiver disponível, o gate requer PostgreSQL/Redis isolados, handlers de produção ligados ao pipeline, aprovação humana de fixture sintética revisada, consulta pelo endpoint real e browser sem mocks; o estado anterior à aprovação deve permanecer invisível no catálogo.

Em 2026-11-11/12, as suítes offline agregadas passaram (backend 5/5, integração PostgreSQL 8/8, Playwright 4/4). Na execução ampliada com mais quatro arquivos de endpoints públicos, 11/15 passaram e quatro GETs retornaram 503 porque o Redis ausente faz o rate limiter falhar fechado. Esse resultado confirma o bloqueio ambiental e não substitui Redis/Testcontainers.
