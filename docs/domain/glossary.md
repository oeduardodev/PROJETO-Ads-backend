# Glossário e taxonomia — passo 005

Referências: arquitetura §§ 1, 2.1, 5.4, 6.2, 9.3, 12.2 e 13.1; ADRs 0001–0003; corpus do passo 004. Estes termos são o contrato conceitual para API e interface. Códigos de fixture em `docs/research/golden-dataset.csv` não são automaticamente enums de banco ou DTOs públicos.

## Entidades e limites

| Termo | Significado operacional |
| --- | --- |
| Instituição | Universidade ou instituto público federal ou estadual, confirmado em fonte institucional. Campus e mantenedora não são sinônimos. |
| Fonte | Página ou índice oficial monitorável. Uma instituição pode ter várias fontes. A presença na matriz não autoriza coleta automática. |
| URL candidata | Endereço descoberto por fonte, busca ou envio; ainda sem prova de pertinência. Nunca aparece como oportunidade publicada. |
| Documento | Artefato HTML ou PDF com URL canônica, hash e versão quando armazená-lo for permitido. Página de publicação, edital, anexo e retificação são documentos distintos. |
| Processo seletivo | Seleção identificável por instituição, edital e período. Pode reunir vários documentos e várias ofertas. Trinta e cinco documentos no corpus não equivalem a 35 processos. |
| Oferta | Curso, grau, campus, turno/modalidade, vagas e regras específicas vinculadas ao processo. Não reduzir uma seleção com múltiplos cursos a um card com uma única vaga. |
| Janela de inscrição | Data/hora inicial e final com fuso e fonte; não confundir com pré-matrícula, recurso ou resultado. Pode haver mais de uma janela. |
| Evidência | Vínculo entre campo, documento oficial, página/seção, trecho curto e data de conferência. Valor sem prova fica desconhecido ou em revisão. |
| Retificação | Documento posterior que altera campos do processo. Preservar original, versão consolidada, relação e histórico da decisão. |
| Verificação humana | Decisão auditável de curador para publicar, corrigir, ocultar ou rejeitar; não é substituída por confiança da IA. |

## Critério de catálogo

O catálogo público exige graduação (bacharelado, licenciatura ou tecnologia superior), instituição pública, curso sem mensalidade, fonte oficial, fluxo fora do SiSU regular e aprovação humana. Taxa de inscrição não é mensalidade. `regular_sisu_flow` e `requires_enem` são atributos independentes e trivalentes (`TRUE`, `FALSE`, `UNKNOWN`). `UNKNOWN` nunca é tratado como `FALSE`. Um edital próprio pode exigir ENEM e continuar candidato ao catálogo. O fluxo regular do SiSU e SiSU+ são `OUT_OF_SCOPE`; seleções próprias de vagas remanescentes originadas no SiSU são `PENDING_REVIEW` no piloto pelo ADR 0003. `IN_SCOPE` no corpus é classificação histórica para teste, não autorização de publicação.

## Tipos observados no corpus

`selection_type` identifica a forma ou finalidade principal do processo, sem determinar sozinho escopo, ENEM ou elegibilidade. Os códigos abaixo são exatamente os do gabarito do passo 004.

| Código | Leitura para curadoria e UI |
| --- | --- |
| `GRADUATE_ENTRY` | Ingresso de portador de diploma de graduação. |
| `TRANSFER` | Transferência para curso de graduação. |
| `COURSE_CHANGE` | Reopção ou mudança de curso. |
| `SPECIFIC_KNOWLEDGE` | Seleção por prova ou conhecimento específico. |
| `REMAINING_SEATS` | Seleção de vagas remanescentes; verificar origem e fluxo antes de enquadrar. |
| `FIELD_EDUCATION` | Processo específico de Educação do Campo. |
| `ENEM_OWN_SELECTION` | Seleção institucional própria que usa nota do ENEM, sem pressupor SiSU. |
| `SCHOOL_RECORD` | Seleção por histórico ou nota do ensino médio. |
| `OLYMPIAD_ENTRY` | Seleção por premiação/participação olímpica. |
| `PRONERA_GRADUATION` | Processo de graduação vinculado ao PRONERA e seu público definido em edital. |
| `SISU` | Fluxo regular do SiSU, exemplo negativo. |
| `SISU_PLUS` | Etapa institucional expressamente complementar ao SiSU, exemplo negativo. |

O código do tipo não substitui os requisitos por oferta. `FIELD_EDUCATION` e `PRONERA_GRADUATION` indicam programa/público; a nota usada para seleção permanece em requisito/evidência separados. Mudança ou fusão dessa taxonomia exige migração explícita do corpus e contrato versionado.

## Rótulos do corpus e linguagem pública

| Rótulo | Uso interno | Texto público quando aplicável |
| --- | --- | --- |
| `IN_SCOPE` | Amostra potencialmente pertinente, ainda sem publicação. | Nenhum card só por este rótulo. |
| `OUT_OF_SCOPE` | Exemplo negativo; não publicar. | Não aparece na busca. |
| `PENDING_REVIEW` | Escopo exige decisão humana documentada. | Não aparece na busca. |
| `UNKNOWN` | Fonte consultada não confirmou o campo. | “Não confirmado” ou “Verificar no edital oficial”. |
| `REVIEWED_*` | Estágio de leitura da fixture, não status de publicação. | Não expor. |

Na interface, usar “Fonte oficial”, “Última verificação”, “Prazo não confirmado”, “Inscrições previstas/abertas/encerradas/suspensas” somente conforme a máquina de estados. Não exibir selo “Você pode se inscrever”; elegibilidade depende do edital e do perfil completo. Inscrição ocorre no portal oficial da instituição.
