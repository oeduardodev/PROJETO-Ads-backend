# ADR 0039: URL pública do detalhe do processo

- Status: aceito pelo usuário
- Passos: 070 e 072
- Data: 2026-11-11

## Contexto

O roteiro dos passos 070 e 072 descreve a navegação de detalhe por `:slug`. A arquitetura, o OpenAPI público e a API implementada definem `GET /processes/:id`, em que `id` é UUID; o contrato `ProcessCard` fornece esse identificador e não contém slug. Adicionar slug exigiria definir unicidade, colisões, estabilidade da URL e mudanças de schema/contrato.

## Decisão

Usar o UUID público e estável do processo como identificador da rota Angular: `/oportunidades/:id`. O detalhe continuará consultando `GET /api/v1/processes/:id`. Não adicionar campo slug nem migration. Considerar a palavra `slug` do roteiro como divergência textual, resolvida por este ADR.

## Consequências

- Cards públicos apontam para `/oportunidades/<uuid>`.
- O passo 072 implementará a rota e a página de detalhe usando o contrato existente.
- Não há impacto no banco, no OpenAPI ou em URLs oficiais.

## Aceite

O usuário escolheu explicitamente a rota baseada em UUID: `/oportunidades/:id` (recomendado).
