# Métricas e objetivos do piloto — passo 005

Referências: arquitetura §§ 2.2, 4.2, 5.4, 10.1, 12, 13 e 15; roteiro 005. As metas são hipóteses de engenharia a testar, não garantias. O corpus histórico rotulado do passo 004 permite medir cobertura da amostra; ainda não há extrator, API, worker ou ambiente de carga para medir precisão operacional, custo ou latência. Registrar `NOT_MEASURED`, não zero.

## Linha de base verificável em 2026-11-02

| Medida do corpus | Valor | Denominador e limite |
| --- | ---: | --- |
| Instituições com fonte na matriz | 4/4 | UFPB, UFCG, UEPB, IFPB; cobertura da lista piloto, não de todos os editais existentes. |
| Artefatos históricos oficiais rotulados | 35 | 15 UFPB, 5 UFCG, 5 UEPB, 10 IFPB. Inclui documentos duplicados do mesmo processo. |
| Formatos e versões | 9 HTML de edital, 1 página de download, 15 PDFs de edital, 10 PDFs de retificação | Contagem de artefatos, não de processos. |
| Escopo rotulado | 29 `IN_SCOPE`, 3 `OUT_OF_SCOPE`, 3 `PENDING_REVIEW` | `IN_SCOPE` é etiqueta de teste, não aprovação de publicação. |
| `regular_sisu_flow` conhecido | 32/35 | `UNKNOWN` não é `FALSE`. |
| `requires_enem` conhecido | 27/35 | Exigência e dispensa contam como conhecidos; desconhecidos permanecem assim. |
| Início e fim de inscrição com data | 25/35 cada | Oito páginas/revisões têm leitura parcial; campos ausentes não são estimados. |
| Hora final confirmada | 23/35 | Há prazos ambíguos, como `UFCG-03`; não atribuir 23h59. |
| Fuso explicitado/associado a evidência | 20/35 | `UNKNOWN` impede cálculo automático de situação quando necessário. |

Esses quocientes descrevem completude da **amostra selecionada**, não recall de descoberta na Web. O denominador de processos únicos deve ser calculado após deduplicação revisada, jamais substituído por 35 documentos. Reproduzir as contagens com `python test/fixtures/institutions/validate_golden_dataset.py` e leitura agregada do CSV.

## Definições de avaliação futura

| Métrica | Cálculo e unidade | Recorte obrigatório |
| --- | --- | --- |
| Precisão por campo | Valores corretos produzidos ÷ valores não nulos produzidos, comparados ao gabarito; valor incorreto é falso positivo. | Reportar separadamente escopo, SiSU, ENEM, datas, horas, tipo, ofertas/requisitos; estratificar por instituição, HTML/PDF e revisão. |
| Cobertura/recall por campo | Valores corretos produzidos ÷ campos confirmados no gabarito. | Excluir `UNKNOWN` do denominador de verdade; reportar taxa de abstenção e casos não aplicáveis. |
| Precisão de publicação | Processos publicados que passam auditoria de URL, escopo e revisão humana ÷ processos publicados auditados. | Meta de URL oficial: 100%; nenhum `PENDING_REVIEW` publicado. |
| Cobertura de descoberta | Processos elegíveis encontrados ÷ processos elegíveis conhecidos por revisão manual independente na janela piloto. | Não usar candidatos coletados como denominador completo; separar fonte/instituição e período. |
| Deduplicação/retificação | Pares corretamente vinculados ÷ pares esperados no corpus; taxa de duplicatas públicas = processos duplicados ÷ processos publicados. | Incluir `UFPB-02/09`, `IFPB-15/16`, `UFPB-15/16`. |
| Latência de busca | p50/p95 em ms de GET indexado, medidos no servidor sob carga de referência declarada. | Registrar hardware, tamanho do catálogo, concorrência, cache e intervalo. Objetivo inicial p95 < 500 ms. |
| Latência de atualização | Tempo entre publicação oficial detectável e entrada em revisão; tempo entre revisão aprovada e publicação. | Relatar p50/p95 por instituição; fontes prioritárias rechecadas ao menos diariamente, sem promessa de tempo real. |
| Custo de ingestão | Custo monetário e tempo por documento e por processo aprovado; bytes, chamadas de busca/IA, tokens, OCR, Playwright e retries. | Medir por provider/fonte e por mês; cache por hash+versão. Sem API paga, registrar custo estimado e execução mockada separadamente. |
| Confiabilidade | Falhas de fetch/parse/IA, retries, dead-letter e idade da última verificação por fonte. | Painel de saúde e alertas; falha do worker não afeta leitura pública da API. |
| Acessibilidade | Falhas automáticas e revisão manual das jornadas públicas contra WCAG 2.2 AA. | Teclado, foco, contraste, rótulos, semântica e responsividade; objetivo, não certificação antecipada. |

## Protocolo de medição e alvos

1. Congelar uma versão do gabarito e amostra de teste antes da execução. Registrar código, schema, prompt/modelo/provider, data, ambiente e custo. Separar casos usados para ajuste dos usados para avaliação; manter pares de retificação no mesmo conjunto para evitar vazamento entre treino e teste.
2. Comparar campos normalizados e evidências, sem considerar `UNKNOWN` como acerto de valor. Reportar numerador, denominador, intervalos por instituição e erros concretos. A arquitetura propõe ≥ 95% de precisão nas extrações revisadas do piloto; tratar como alvo a validar, não número já alcançado.
3. Exigir 100% de URL oficial em registros publicados e auditoria humana documentada. Ausência ou conflito de prazo/requisito fica em revisão ou aparece como não confirmado, jamais como valor presumido.
4. Medir p95 < 500 ms apenas após carga de referência e índices definidos. Registrar ingestão e busca separadamente; não usar tempo de resposta de uma fonte oficial como latência da API.
5. Antes de cada gate, anexar resultados, falhas, versão do corpus e decisão em `docs/implementation/PROGRESS.md`. `NOT_MEASURED` permanece para precisão do extrator, recall de descoberta, custo e latência até existirem os respectivos componentes.
