# OpenAPI público e cliente Angular

O artefato canônico da API pública é apps/api/openapi/public-v1.json. O NestJS
gera o documento a partir das rotas e dos schemas explícitos em
apps/api/src/openapi/. Em execução, a documentação interativa fica em
/api/v1/docs e o JSON em /api/v1/openapi.json.

O frontend mantém uma cópia do contrato em contracts/public-v1.json, pois os
projetos têm históricos Git separados. Ao alterar a API, gere o arquivo no
backend, revise a mudança, copie o JSON para o frontend e regenere
apps/web/src/app/core/api/generated/ com pnpm api:generate. O CI de cada
repositório confere respectivamente o documento NestJS e o cliente gerado.

## Evolução compatível

- Preserve nomes, tipos, significado, nulabilidade, parâmetros e códigos HTTP
  publicados em /api/v1.
- Mudanças aditivas devem ser opcionais ou usar novos campos sem alterar o
  significado dos já existentes. Consumidores devem ignorar campos
  desconhecidos.
- Remover/renomear campos, estreitar enums, tornar campos obrigatórios ou mudar
  semântica exige uma nova versão de rota, como /api/v2, com período de
  coexistência e plano de migração documentado.
- Nunca expor campos administrativos, notas de revisão, segredos ou chaves de
  storage no schema público.
- pnpm openapi:check falha se a geração NestJS divergir do artefato
  versionado; test/openapi-contract.test.mjs protege as operações públicas
  e invariantes selecionadas do contrato.
