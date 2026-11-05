# ADR 0023 — alertas de saúde de conectores

- Estado: ACEITO; escolha explícita do usuário no passo 040.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura § 11.2; roteiro 040; ADRs 0017 e 0018.

## Contexto

A arquitetura pede métricas de falhas e tempo desde a última coleta bem-sucedida e alertas operacionais, sem especificar limiares. Repetir alertas em cada tentativa transitória pode gerar ruído; silêncios longos em uma fonte ativa também precisam ser detectados.

## Alternativas

1. **Aviso inicial e escalonamento por recorrência/atraso (escolhida):** aviso na primeira falha final; alerta após três falhas finais consecutivas ou duas frequências configuradas sem sucesso. Zero candidatos em uma coleta bem-sucedida produz aviso para revisão, não alerta de conector quebrado.
2. **Alertar a primeira falha final:** detecta incidentes cedo, mas não distingue falhas transitórias das persistentes.

## Decisão e consequências

Aplicar somente a fontes `ACTIVE`, com host exato revisado e coleta autorizada **no início da execução**. A falha é contada após retries/backoff do cliente HTTP terminarem. Gerar aviso na primeira falha final; escalar quando ocorrerem três falhas finais consecutivas ou quando existir `lastSuccessAt` e transcorrerem duas frequências configuradas sem sucesso. Para uma fonte ainda sem sucesso, aplicar o limiar de três falhas consecutivas. Sucesso subsequente resolve o alerta. Uma coleta bem-sucedida com zero candidatos gera somente aviso para revisão humana.

Fontes `DRAFT`, `BLOCKED` ou `PAUSED` antes de uma execução não geram alertas de coleta nem de atraso. Se uma fonte ativa for pausada como consequência de uma falha final, preserve o aviso/alerta daquela execução; suprima novos alertas de atraso enquanto estiver pausada, até revisão e reativação. O ADR define a regra; emissor, destino e persistência de métricas dependem de instrumentação operacional posterior. Alertas não publicam nem descartam candidatos.
