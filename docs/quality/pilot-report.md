# Auditoria do piloto de fontes e corpus

## Escopo e conclusão

Esta auditoria do passo 082 revisa os quatro índices institucionais, a matriz de fontes e o corpus histórico rotulado em 2026-11-11 (America/Sao_Paulo). Ela mede o inventário e a evidência disponível; não declara cobertura completa, autorização de coleta ou desempenho do classificador. Nenhum registro vigente foi adicionado, corrigido ou publicado. Os quatro conectores permanecem `DRAFT`, com coleta desativada.

## Cobertura observada

| Instituição | Inventário histórico | Leitura do índice oficial em 2026-11-11 (America/Sao_Paulo) | Limite identificado |
| --- | ---: | --- | --- |
| UFPB | 15 artefatos | Índice da PRG acessível, com categorias próprias, SiSU e SiSU+; lista processos PSRC/PSTV/PSIG/PSE de 2027 e SISU+ 2026 | Cada processo e edital precisa de revisão; página de listagem não comprova taxa, prazo ou escopo. |
| UFCG | 5 artefatos | Página de graduação acessível; mistura SiSU, entradas derivadas, vagas remanescentes e seleções próprias; declara CC BY-ND 3.0 | A licença e a retenção precisam de avaliação antes de crawling ou cópia; não acessar os caminhos bloqueados por robots. |
| UEPB | 5 artefatos | GET direto ao índice oficial retornou HTTP 200 em 2026-11-12; `robots.txt` retornou 403 | A listagem está acessível para auditoria manual; manter coleta automatizada desativada e esclarecer a política indicada pelo 403 antes de habilitar o crawler. |
| IFPB | 10 artefatos | GET direto ao portal de editais retornou HTTP 503 uma vez em 2026-11-12, divergindo da leitura pelo browser em 2026-11-11 | Uma resposta isolada não prova indisponibilidade da origem. Revalidar manualmente antes de tratar uma falha como persistente; termos e coleta automatizada continuam pendentes. |

As observações recentes e as datas das últimas confirmações de `robots.txt` estão em [`source-matrix.csv`](../research/source-matrix.csv). Os três índices renderizados são evidência de disponibilidade para leitura, não de completude. Os conectores seguem desligados conforme [`crawl-policy.md`](../research/crawl-policy.md).

## Métricas do corpus

`validate_golden_dataset.py` passou: 35 artefatos, quatro instituições (UFPB 15, UFCG 5, UEPB 5, IFPB 10), seis tipos de caso e invariantes de duplicatas/revisões preservados. O conjunto contém páginas, editais e retificações; 35 artefatos não equivalem a 35 processos independentes nem a uma amostra estatística de cobertura.

- Escopo rotulado: 29 `IN_SCOPE`, 3 `OUT_OF_SCOPE` e 3 `PENDING_REVIEW` para seleção própria associada a vagas remanescentes do SiSU.
- ENEM: 12 `TRUE`, 15 `FALSE` e 8 `UNKNOWN`. Oito artefatos mantêm revisão parcial; não converter desconhecido em não.
- Início/fim de inscrição: cada data está `UNKNOWN` em 10 linhas; hora inicial em 21 e hora final em 12. Fuso permanece desconhecido em 15 linhas. Prazos incompletos continuam sem horário inventado.
- Relação com versão/documento: 22 linhas têm `related_id` e 13 não informam vínculo. Revisões conhecidas preservam relações; há original ausente ou conflito descrito no relatório do corpus.
- Taxa de inscrição: o CSV histórico não possui coluna para taxa de inscrição/isenção. Portanto não há medição agregada nem alegação de precisão desse campo. Mensalidade/gratuidade não deve ser inferida a partir de taxa de inscrição.

Conflitos conhecidos permanecem explícitos no [`golden-dataset.md`](../research/golden-dataset.md): divergência de semestre UFPB entre página/PDF; aparente ano `2054` no cronograma UFCG; relações de retificação e originais ausentes; e classificação humana pendente para casos de vagas remanescentes. Nenhuma falha nova foi atribuída a um rótulo sem reabrir e revisar o documento oficial correspondente.

## Qualidade, custo e revisão humana

A meta arquitetural de pelo menos 95% de precisão em extrações críticas não pode ser medida com este artefato: o corpus guarda rótulos e referências a seções, mas não títulos nem trechos verificados para rodar o extrator/classificador sem vazamento do gabarito. ADR 0030 registra esta limitação. A suíte sintética valida regras, não mede recall/precisão do piloto real. A validação automática atual não detectou violação dos invariantes de dados.

Não houve fetch automatizado, snapshot, chamada de busca externa ou chamada de IA nesta auditoria; custo variável de serviços externos nesta execução foi zero. Isso não estima infraestrutura gerenciada, custo de operação futura, custo humano de revisão nem preço de APIs. O limite de IA continua zero por padrão. Toda adição de candidato, resolução de ambiguidade, retificação, taxa, prazo ou decisão de publicação requer pessoa curadora e evidência oficial por campo crítico.

## Pendências bloqueantes

1. A página UEPB foi confirmada por acesso direto; esclarecer o `robots.txt` 403 e os termos/limites de cada fonte antes de automatizar. Revalidar a disponibilidade IFPB após a resposta isolada 503.
2. Rever licença e retenção UFCG; manter storage de snapshots oficiais bloqueado até política aprovada por fonte (ADR 0008).
3. Curar títulos, trechos curtos e evidências oficiais para o corpus, incluindo taxa de inscrição/isencão; então medir precisão/recall sem derivar entrada dos rótulos.
4. Revisar as 8 linhas parciais, 3 casos `PENDING_REVIEW`, conflitos e originais de retificação ausentes; não alterar gabarito sem revisão humana.
5. Definir cobertura como métricas observadas por fonte/período e validar qualidade em staging antes de qualquer expectativa de atualização.

## Evidências reproduzíveis

- `py test/fixtures/institutions/validate_golden_dataset.py` — PASS, 35 artefatos, quatro instituições e seis classes de caso.
- Observação pontual dos índices institucionais oficiais; detalhes em `source-matrix.csv`. Não representa coleta automatizada nem rastreamento de editais individuais.
- Fonte oficial UFPB: [índice de editais PRG](https://www.prg.ufpb.br/editais/ingressantes/).
- Fonte oficial UFCG: [COMPROV — graduação](https://comprov.ufcg.edu.br/graduacao.html).
- Fonte oficial UEPB: [PROGRAD — processos seletivos](https://uepb.edu.br/prograd/processos-seletivos/); leitura falhou no serviço de navegação, origem não confirmada.
- Fonte oficial IFPB: [Portal do Estudante — editais](https://estudante.ifpb.edu.br/editais/).

## Releitura manual de índices — 2026-11-11 (America/Sao_Paulo)

Uma nova leitura em navegador somente leitura confirmou a disponibilidade de conteúdo nos índices oficiais da [UFPB](https://www.prg.ufpb.br/editais/ingressantes/), [UFCG](https://comprov.ufcg.edu.br/graduacao.html) e [IFPB](https://estudante.ifpb.edu.br/editais/). A UFPB lista categorias PSRC/PSTV/PSIG/PSE 2027 e também SiSU/SiSU+; a COMPROV lista ingresso derivado, vagas remanescentes e processo de Psicologia 2026 e declara CC BY-ND 3.0; o IFPB mostra editais de pós-graduação e chamadas por campus cuja categoria não pode ser inferida só pelo título. Nenhum documento foi aberto ou baixado e nenhum candidato foi acrescentado ao corpus.

A página da [UEPB](https://uepb.edu.br/prograd/processos-seletivos/) retornou novamente 502 no leitor web. Isso não confirma falha na origem; `robots.txt` das quatro fontes também não foi revalidado diretamente nesta ferramenta. Permanecem os últimos resultados diretos datados de 2026-11-02 na matriz. Todos os conectores continuam `DRAFT`/desativados, sem fetch, snapshot, classificação ou publicação; autorização, termos/licenças e evidência por processo continuam exigindo revisão humana.

## Rechecagem HTTP direta, somente leitura — 2026-11-12

Uma requisição GET manual por índice e outra por `robots.txt`, com User-Agent identificado, retornaram: UFPB 200/404; UFCG 200/200; UEPB 200/403; IFPB 503/404. No robots da UFCG, as diretivas observadas bloqueiam caminhos administrativos/internos do Joomla; nenhum desses caminhos foi acessado. O 503 do IFPB é uma observação isolada e diverge do browser de 2026-11-11, sem demonstrar falha persistente da origem. A página PROGRAD da UEPB ficou diretamente acessível, mas seu robots 403 não autoriza automação. Foram lidas apenas respostas dos índices e dos arquivos robots; nenhum link de edital foi seguido, nenhum documento baixado e nenhum candidato ou rótulo alterado. As quatro fontes permanecem `DRAFT`; pendem política de acesso/termos/licença e revisão humana antes de qualquer ativação.

