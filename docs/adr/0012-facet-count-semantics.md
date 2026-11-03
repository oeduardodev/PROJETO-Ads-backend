# ADR 0012 — semântica das contagens de facetas

- Estado: ACEITO; escolha explícita do usuário no passo 025.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 7–9 e 12; roteiro 025.

## Contexto

`GET /filters` deve apresentar UF, modalidade, tipo e ENEM com contagens apenas de processos publicados. Um processo pode ter várias ofertas. O roteiro pede filtros combinados, mas não define se a contagem de uma faceta ignora sua própria seleção.

## Alternativas

1. **Todos os filtros aplicados:** cada faceta reflete somente processos e ofertas que satisfazem todos os filtros ativos, inclusive o da própria faceta. A contagem é por processo distinto, para não multiplicar um edital com várias ofertas. É a proposta conservadora.
2. **Alternativas por faceta:** ao computar UF, por exemplo, ignora-se o filtro atual de UF; mostra resultados possíveis ao trocar a UF. É útil para navegação, mas exige semântica diferente por faceta.

## Decisão e consequências

Alternativa 1 escolhida. Todas as contagens respeitam todos os filtros ativos. `requires_enem` preserva `true`, `false` e `unknown` separados; rascunhos e demonstrações históricas não aparecem. A mesma oferta deve satisfazer UF e modalidade quando ambos são filtrados. A contagem é por processo distinto, mesmo que tenha várias ofertas coincidentes.
