# Diretório público de instituições

`GET /api/v1/institutions` retorna `{ data, meta }` com `page`, `pageSize` e `total`. Entram somente instituições públicas federais/estaduais com `verified_at` e ao menos uma fonte `ACTIVE` em domínio revisado. Cada campus também exige `verified_at` próprio. A seed inicial não cumpre esses critérios e produz lista vazia até revisão humana.

Cada item expõe identificador, nome, sigla, jurisdição, link institucional e data de verificação, além de campi revisados. `monitoring` contém apenas número de fontes ativas revisadas e horários agregados da última checagem e do último sucesso. Um horário nulo significa ausência de observação, e esses dados não representam cobertura completa. URLs de fontes, seletores e configuração de coleta não saem da API.

As rotas públicas de dados usam prefixo `/api/v1`; `/health` e `/ready` permanecem na raiz para probes. A distinção e os critérios foram aceitos no ADR 0011. O teste de integração cria verificação temporária no banco local, consulta o endpoint e a remove em seguida.
