# Relatório de avaliação — passo 057

- Data da execução: 2026-11-08 (America/Sao_Paulo).
- Corpus etiquetado: `golden-dataset.csv`, versão congelada pelas referências do passo 004 (35 artefatos; rótulos conferidos em 2026-11-02).
- Avaliador: `apps/api/test/evaluation/metrics.mjs`.
- Código: passos 050–056; contratos `ClassificationV1` e `ExtractionV1`; prompt de extração `extraction-v1`.
- Provider/modelo externo: nenhum. Chamadas nos testes usam fixtures.

## Resultados medidos

| Medida | Resultado | Amostra e limite |
| --- | --- | --- |
| Classificação sintética `IN_SCOPE` | precisão 1,00; recall 1,00 | 4 casos sintéticos positivos derivados das políticas ADR; não representa o corpus nem o piloto. |
| Classificação sintética `OUT_OF_SCOPE` | precisão 1,00; recall 1,00 | 6 casos sintéticos negativos: SiSU, SiSU+, pós-graduação, técnico, privado e curso pago. |
| Casos sintéticos encaminhados a revisão | 3/3 | Menção ambígua a SiSU, vagas remanescentes do SiSU e conflito entre seleção própria e fluxo regular. Não entram nos denominadores positivos/negativos. |
| Extração no corpus real por campo | `NOT_MEASURED` | O CSV tem rótulos e referências de seção, mas não fornece os trechos/títulos versionados necessários para comparar saída do extrator sem vazamento do gabarito. |
| Tokens/custo real por documento | `NOT_MEASURED` | Nenhuma chamada a provider externo; usage de fixtures é sintético e excluído do cálculo. Orçamento financeiro não foi escolhido. |
| Regressões reais por prompt/modelo | `NOT_MEASURED` | Há suporte de comparação no avaliador, mas não há duas execuções reais versionadas no mesmo conjunto curado. |

## Cobertura ausente no corpus de avaliação

Precisão e recall reais para tipo de seleção, SiSU, ENEM, datas/horas/fuso,
cursos, vagas, reservas, requisitos e vínculos de fonte continuam pendentes de
curadoria humana com evidência por campo. O corpus contém 35 artefatos, não 35
processos distintos, e sua completude não mede recall de descoberta na Web.
Nenhum valor `UNKNOWN` é tratado como falso ou como erro do sistema.

## Protocolo implementado

O avaliador exige versão do conjunto, caso, prompt e modelo. Por campo, exclui
gabaritos `null`, `UNKNOWN` e `NOT_MEASURED`, calcula precisão entre valores
emitidos, recall contra os valores confirmados, cobertura e abstenções. Separa
usage de provider de dados mockados e compara regressões apenas para o mesmo
caso e campo entre versões. Os testes do avaliador usam exemplos artificiais
rotulados somente para validar essas contas.

## Próximo gate

Curar título/trechos oficiais e saída esperada independente, com conjuntos
congelados sem pares de retificação cruzando treino e teste, antes de alegar a
meta de precisão de 95% ou passar o gate de qualidade do piloto. Até lá, o
resultado deste relatório não autoriza publicação automática.
