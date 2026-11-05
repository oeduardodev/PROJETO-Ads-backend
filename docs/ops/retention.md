# Retenção de snapshots e resultados de parser

## Estado e limites

A política de retenção começa desativada. Uma fonte só pode receber prazo
positivo após revisão explícita, registrada em `retention_reviewed_at` junto de
`snapshot_retention_days`. Valor nulo nos dois campos significa que não há
autorização para expiração automática. A API de configuração valida esses
campos, mas a revisão e aprovação continuam sendo uma ação operacional
explícita.

O armazenamento de snapshots oficiais permanece bloqueado pelo ADR 0008 até
revisão por fonte. `FixtureLocalStorage` aceita somente artefatos sintéticos de
teste em diretório temporário. Nenhuma tarefa agendada executa a limpeza neste
passo.

## Cache de extração

Resultados JSON são identificados por SHA-256, tipo de parser e versão. Alterar
o parser exige incrementar sua versão. Saídas que não sejam objetos JSON
serializáveis não entram no cache. O cache exige um blob existente e ainda não
expirado; snapshots expirados não podem ser extraídos novamente.

## Regras de expiração

Um blob compartilhado só é elegível quando cada documento associado tem ao
menos uma observação de descoberta e todas as fontes dessas observações têm
prazo positivo e revisão registrada. O prazo efetivo do blob é o maior prazo
entre todas as associações, contado do mais recente entre `captured_at` e
`retention_reviewed_at`, para não antecipar a expiração ao habilitar ou revisar
a política. Fonte sem revisão, documento sem proveniência ou qualquer
associação sem prazo mantém bytes e cache.

Quando elegível, a limpeza remove os bytes e os resultados de parser e marca o
blob como expirado. Registros de documentos e suas versões, hashes,
procedência, relações e evidências editoriais permanecem no banco. A exclusão
local é idempotente para permitir nova tentativa após falha intermediária. A
limpeza recebe uma abstração de storage e não escolhe nem configura um provedor
de produção.

## Operação

Antes de ativar retenção para uma fonte, revisar termos/licença, necessidade de
preservação e prazo aplicável; registrar o prazo e a data da revisão pelo
`SourcesRepository.setSnapshotRetentionPolicy`. Até haver job operacional com
paginação, métricas, auditoria e storage de produção revisados, executar a
rotina apenas em testes ou ambientes locais autorizados. Não aplicar esta
migration em produção como parte do passo 046. A limpeza aceita cursor SHA-256
para percorrer os blobs em lotes sem deixar registros antigos inelegíveis
bloquearem os seguintes.
