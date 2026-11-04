# ADR 0016 — destino de jobs após falha final

- Estado: ACEITO; escolha explícita do usuário no passo 031.
- Data: 2026-11-04 (America/Sao_Paulo).
- Referências: arquitetura §§ 3, 7.2 e 11; roteiro 031.

## Contexto

A arquitetura exige dead-letter para falhas finais e o roteiro 031 exige retry,
backoff e validação de falha simulada até dead-letter. Ela não define se o
dead-letter deve ser uma fila separada ou o conjunto failed persistido em cada
fila BullMQ. A escolha afeta retenção, reprocessamento e cópia de payloads.

## Alternativas

1. **Conjunto failed por fila (recomendado):** manter sem remoção automática
   todo job que esgotar as tentativas. O registro preserva fila, nome, ID,
   payload, tentativas e motivo; a inspeção e retry manual usam a própria API
   BullMQ. Não há cópia entre filas.
2. **Fila central dead-letter:** ao esgotar tentativas, copiar um envelope
   mínimo com fila/nome/ID originais, tentativas, motivo e data. Usar ID
   idempotente derivado do job original. Facilita uma visão central, mas cria
   uma transferência adicional que precisa resistir a falha entre a falha
   final e a cópia; o payload não deve conter documentos nem dados pessoais.

A documentação oficial informa que jobs falhos são mantidos por padrão e
podem ser inspecionados ou repetidos manualmente, e que a entrega é pelo menos
uma vez: [failed jobs e retenção](https://docs.bullmq.io/guide/going-to-production),
[retry](https://docs.bullmq.io/guide/retrying-failing-jobs).

## Recomendação

Começar pela alternativa 1: a própria coleção de falhas finais de cada fila
funciona como dead-letter durável. Centralizar em uma fila só se uma necessidade
operacional concreta justificar a cópia e a reconciliação adicionais.

## Decisão

O usuário escolheu a alternativa 1: usar o failed set persistido de cada fila
como dead-letter. Jobs esgotados não serão removidos automaticamente; poderão
ser inspecionados e repetidos pela API BullMQ. A fila central não será criada.
