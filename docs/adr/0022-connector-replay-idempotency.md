# ADR 0022 — semântica de replay por execução de coleta

- Estado: ACEITO; escolha explícita do usuário no passo 040.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2 e 7.2; roteiro 040; ADR 0007.

## Contexto

A arquitetura exige jobs `source.refresh` idempotentes por fonte e janela. O ADR 0007 decidiu a identidade global por URL canônica e preservação de proveniência, mas descreveu incremento por detecção sem fixar o efeito da repetição do mesmo `crawlRunId`. Reexecutar a mesma entrada poderia aumentar `seen_count` e alterar `last_seen_at`, mesmo sem uma nova execução.

## Alternativas

1. **Uma observação por candidato e `crawlRunId` (escolhida):** repetições da mesma execução retornam o candidato existente sem alterar contadores ou timestamps. Nova execução cria outra observação e incrementa os contadores uma vez.
2. **Contar cada chamada de detecção:** preserva a implementação anterior, mas uma repetição técnica não é idempotente e infla métricas.

## Decisão e consequências

A unicidade global por URL canônica permanece. A chave da observação continua sendo candidato + `crawlRunId`; replays dessa chave não mudam nenhum campo persistido. Uma nova execução cria uma observação e incrementa `seen_count` do candidato uma vez. O acesso concorrente ao mesmo URL é serializado dentro da transação para impedir incrementos duplicados sob retry concorrente.

O estado inicial permanece `CANDIDATE`; esta decisão não publica dados nem torna elegível um edital. A observação continua vinculada à fonte e execução originais.
