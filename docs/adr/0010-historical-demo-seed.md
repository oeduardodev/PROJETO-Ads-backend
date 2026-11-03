# ADR 0010 — seed histórica de demonstração

- Estado: ACEITO; escolha explícita do usuário no passo 021.
- Data: 2026-11-03 (America/Sao_Paulo).
- Referências: arquitetura §§ 1.2, 6–6.2 e 12.2; roteiro 021; `docs/research/golden-dataset.csv` e `golden-dataset.md`.

## Contexto

O roteiro exige seed determinística de demonstração marcada como histórica. O projeto proíbe inventar editais/links e publicar sem fonte oficial e revisão humana. A seed atual cadastra apenas quatro instituições com links oficiais, sem processos.

## Alternativas

1. Usar um processo histórico real do corpus manualmente conferido, UFPB-12, com URL oficial já registrada, estado `RASCUNHO`, marcador `demo_historical` e constraint que proíbe `PUBLICADO` para registros de demonstração. O registro de demonstração não será apresentado como inscrição vigente, nem conterá PDF copiado. Reexecutar a seed não duplica o processo.
2. Manter somente a seed de instituições e adiar o processo histórico. Preserva máxima cautela, mas deixa incompleto o artefato pedido no passo 021.

## Decisão e consequências

Alternativa 1 escolhida pelo usuário. O registro usa apenas campos conferidos no corpus: instituição, código/ano, tipo, fluxo fora do SiSU, ENEM, janela e URL oficial. Gratuidade específica, ofertas e vagas permanecem desconhecidas. A seed é local, idempotente, histórica e sempre rascunho. Uma constraint impede que registros marcados como demonstração sejam publicados.
