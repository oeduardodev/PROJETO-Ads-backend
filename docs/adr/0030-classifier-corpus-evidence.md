# ADR 0030 — evidência do corpus para o classificador de escopo

- Estado: ACEITO no passo 050, por decisão do usuário.
- Data: 2026-11-07 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.3, 5.1 e 5.2; roteiro 050; ADRs 0001, 0003 e 0021; `docs/research/golden-dataset.csv`; contrato `ClassificationV1`.

## Contexto

O passo 050 exige combinar heurísticas, título e trechos e medir precisão/recall
no corpus, encaminhando ambiguidades a `NEEDS_REVIEW`. O corpus versionado tem
35 rótulos por artefato e referências de seção em `field_evidence`, mas não
contém o título nem o texto dessas seções. O manifesto de candidatos contém
URLs, que podem priorizar candidatos, mas o ADR 0021 proíbe usá-las como prova
para descartar. Derivar entrada a partir dos próprios rótulos causaria
vazamento do gabarito; criar trechos sem consulta e conferência oficial
inventaria evidência.

O contrato `ClassificationV1` usa `IN_SCOPE`, `OUT_OF_SCOPE`, `PENDING_REVIEW`
e `UNKNOWN`. A palavra `NEEDS_REVIEW` no checkpoint não é um valor do schema.

## Alternativas

1. **Matriz sintética conservadora (recomendada):** implementar a política com
   fixtures sintéticas derivadas somente dos casos de aceite já aprovados nos
   ADRs 0001, 0003 e 0021. Encaminhar ambiguidades a `PENDING_REVIEW`. Manter
   precisão/recall do corpus real pendentes até existirem entradas verificadas
   com título, trechos, fonte oficial e seção; não apresentar a matriz
   sintética como medição do corpus.
2. **Curar entradas textuais do corpus antes do classificador:** adicionar
   títulos e trechos mínimos citáveis para cada caso medido, com URL oficial,
   seção/página, data de conferência e revisão humana. Só então calcular
   precisão/recall; não copiar PDFs ou criar transcrições não verificadas.

## Decisão

O usuário escolheu a alternativa 1: fixtures sintéticas derivadas dos casos de
aceite aprovados nos ADRs 0001, 0003 e 0021. Essas fixtures medem a política
implementada, sem se apresentar como precisão/recall do corpus histórico.
Ambiguidades retornam `PENDING_REVIEW`, valor do contrato `ClassificationV1`
que representa o `NEEDS_REVIEW` operacional. A medição sobre o corpus real
permanece pendente até a curadoria e revisão humana de entradas com título,
trechos e referência oficial verificável. Nenhuma transcrição ou dado oficial
é inferido para preencher a lacuna.
