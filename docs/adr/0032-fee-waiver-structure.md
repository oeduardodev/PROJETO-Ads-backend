# ADR 0032 — representação da isenção de taxa

- Estado: PROPOSTO no passo 053; requer decisão de produto e curadoria.
- Data: 2026-11-07 (America/Sao_Paulo).
- Referências: arquitetura §§ 1.2, 2.1 (RF-05), 5.3–5.4; roteiro 053; `ExtractionV1`.

## Contexto

O contrato `ExtractionV1` distingue mensalidade (`tuition_free`) de taxa de
inscrição (`application_fee_brl`), mas não contém campo próprio para isenção da
taxa, condições nem evidência correspondente. Requisitos genéricos podem citar
isenção, mas não indicam com segurança a quem ela se aplica ou o prazo do pedido.

## Alternativas

1. Criar entidade estruturada de isenção, com público, condições, prazo e
   evidência por campo, e versionar o contrato de extração.
2. Guardar a isenção em requisitos genéricos e exigir interpretação humana para
   cada caso antes de publicar.

## Decisão provisória para o passo 053

Taxa positiva não é tratada como mensalidade nem exclui a seleção. O validador
emite `FEE_WAIVER_UNMODELED` e mantém a seleção em revisão. Não presume que há
isenção nem que ela é inexistente. A estrutura definitiva e a publicação de
dados de isenção ficam pendentes de decisão e revisão humana.
