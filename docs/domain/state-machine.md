# Estados de ingestão, publicação e inscrição — passo 005

Referências: arquitetura §§ 5.2–5.4, 6.2, 9.3, 12.2; ADRs 0001–0003. A seta única da arquitetura § 6.2 é um fluxo conceitual; os três eixos abaixo são armazenados/calculados separadamente, conforme a própria seção determina. `PUBLISHED` do desenho corresponde a `PUBLICADO` no eixo de publicação; `CLOSED` corresponde à inscrição `ENCERRADA`, não à perda do documento.

## Ingestão e revisão do documento/processo

| Estado | Entrada | Próximas transições permitidas |
| --- | --- | --- |
| `CANDIDATE` | URL descoberta, sem classificação conclusiva. | `FETCHED` ou permanecer candidato por bloqueio/falha de acesso. |
| `FETCHED` | HTML/PDF obtido de forma permitida, com URL e hash quando retenção autorizada. | `CLASSIFIED`; falha de parse vai para fila de reprocessamento, sem publicação. |
| `CLASSIFIED` | Regras determinísticas marcaram relevância preliminar. | `EXTRACTED`, `NEEDS_REVIEW` ou `REJECTED` com motivo. |
| `EXTRACTED` | Campos estruturados e referências a evidências produzidos. | `NEEDS_REVIEW`; validação pode rejeitar falso positivo fundamentado. |
| `NEEDS_REVIEW` | Falta ou conflito em fonte, escopo, prazo, requisito, vagas ou revisão. | `VERIFIED` após decisão humana ou `REJECTED` com justificativa. |
| `VERIFIED` | Curador confirmou valores críticos e versão oficial. | Nova retificação leva a `NEEDS_REVIEW`; documento antigo pode ser `SUPERSEDED`. |
| `REJECTED` | Fora de escopo ou sem prova suficiente, com razão auditável. | Reabertura só com novo documento/evidência e histórico preservado. |
| `SUPERSEDED` | Documento substituído por retificação identificada. | Estado terminal da versão, não do processo; nova versão segue sua própria revisão. |

O processo pode relacionar vários documentos em estados diferentes. Reprocessar o mesmo hash e versão não cria novo processo ou nova notificação. `PENDING_REVIEW` no gabarito é rótulo de escopo, enquanto `NEEDS_REVIEW` é estágio de ingestão; ambos impedem publicação automática. O worker não escreve `PUBLICADO` diretamente.

## Publicação do processo

| Estado | Regra de transição |
| --- | --- |
| `RASCUNHO` | Inicial; invisível no catálogo. |
| `EM_REVISAO` | Fonte/campos em checagem; invisível. Pode voltar a `RASCUNHO`, avançar para `PUBLICADO` ou ser `ARQUIVADO`. |
| `PUBLICADO` | Só por decisão humana auditável, após fonte oficial, escopo e campos críticos confirmados. Pode ir a `OCULTO` por correção/retificação ou `ARQUIVADO` ao fim da vida editorial. |
| `OCULTO` | Retirado da busca sem apagar histórico; republicação exige nova revisão humana. |
| `ARQUIVADO` | Estado editorial final, preservado para auditoria; invisível na busca de oportunidades atuais. |

Falha da IA, crawler ou fonte não retira automaticamente um processo já publicado; uma revisão/retificação com conflito exige ação editorial documentada. Exibir histórico somente conforme política de produto e privacidade. Publicação e reabertura são eventos auditados com ator, motivo, data e versão.

## Situação da inscrição (derivada, sem gravação como verdade)

| Estado | Condição mínima |
| --- | --- |
| `SUSPENSA` | Aviso oficial vigente suspende inscrições; prevalece sobre datas antigas. |
| `INDETERMINADA` | Data, hora necessária ou fuso não confirmados, conflito entre versões ou fonte insuficiente para afirmar situação. Mostrar “Verificar prazo no edital oficial”. |
| `PREVISTA` | Janela oficial completa e fuso confiável; instante atual anterior ao início. |
| `ABERTA` | Janela oficial completa e fuso confiável; instante atual entre início e fim, inclusive início e antes do término. |
| `ENCERRADA` | Janela oficial completa e fuso confiável; instante atual igual ou posterior ao término. |

Não inferir 23h59 de uma data sem hora. Se o edital só der dia de término, a UI não calcula `ABERTA`/`ENCERRADA` no último dia; sinaliza `INDETERMINADA` até revisão. A data do corpus é histórica e não prova situação atual. Mudança de fuso, prazo ou suspensão exige nova derivação com a versão vigente. A inscrição sempre é externa, no portal oficial.

## Casos de aceite ligados ao corpus

- `UFCG-03`: data final conhecida e hora `UNKNOWN` → `INDETERMINADA` no limite; nenhum 23h59 inventado.
- `IFPB-15/16`: retificação troca 27/07 por 20/07/2026; preservar as duas versões, usar a vigente só após revisão.
- `UFPB-05` e `UFCG-05`: SiSU/SiSU+ → rejeição de escopo, nunca `PUBLICADO`.
- `UFCG-02`, `UEPB-01` e `UEPB-04`: `PENDING_REVIEW` por ADR 0003, mesmo com prazo ou ENEM conhecidos.
- `UFPB-02/09`: página e PDF do mesmo processo não geram duas oportunidades.
