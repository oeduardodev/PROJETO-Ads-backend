# ADR 0026 — relações entre documentos versionados

- Estado: ACEITO; escolha explícita do usuário no passo 045.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.1, 5.2, 6 e 10.1; roteiro 045; ADR 0008.

## Contexto

O roteiro pede que o edital principal, anexos, cronogramas e retificações sejam
persistidos como documentos vinculados, sem presumir um identificador comum.
A arquitetura exige identidade e hash próprios por documento e preservação de
snapshots, mas não define direção, tipos ou temporalidade das relações. Hoje,
`Document` preserva versões imutáveis por URL e hash; ainda não há relação entre
dois documentos.

## Alternativas

1. **Aresta tipada entre versões imutáveis de documentos (recomendada):** uma
   tabela `DocumentRelation` referencia o documento que contém/origina o vínculo
   e o documento relacionado. `relationType` aceita `ATTACHMENT`, `TIMELINE`,
   `RECTIFICATION` ou `RELATED`. A relação aponta para IDs de snapshots
   específicos; nova captura cria novos documentos e relações, sem reescrever o
   histórico. O mesmo documento pode ter vínculos diferentes ou vir de mais de
   uma fonte.
2. **Relação entre famílias de URL:** relacionar URLs canônicas, não snapshots.
   Uma consulta sempre acompanha a versão mais recente, mas perde qual versão
   originou o vínculo e pode alterar retroativamente o contexto histórico.
3. **Campos `kind` e `parentDocumentId` em `Document`:** mais simples, porém
   permite apenas um pai e uma classificação por documento, não registra
   relações observadas por mais de uma fonte e mistura identidade do snapshot
   com sua função contextual.

## Decisão e consequências

A opção 1 preserva procedência e hash por URL/versão; a direção representa o
documento que informou a relação para o documento relacionado. O tipo `RELATED`
mantém vínculos cuja função ainda não foi revisada, sem inferir que um arquivo é
retificação ou cronograma. Relações só serão criadas entre documentos já
registrados. A política do ADR 0008 permanece: testes usam bytes sintéticos em
storage local; capturas oficiais continuam bloqueadas por revisão de licença e
retenção por fonte.

## Decisão

Aceita pelo usuário no passo 045. A tabela de relações usa os tipos e a
orientação da alternativa 1. Os vínculos apontam para IDs de snapshots
específicos, preservando relações históricas quando uma URL recebe nova versão.
