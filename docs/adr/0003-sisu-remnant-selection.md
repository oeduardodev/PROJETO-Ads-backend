# ADR 0003 — Seleção autônoma de vagas originadas no SiSU

- Estado: ACEITO para o piloto; classificação individual permanece em revisão humana.
- Data: 2026-11-02.
- Referências: arquitetura §§ 1, 4.3, 5.4 e 14; roteiro 004–005.

## Contexto

A arquitetura exclui o fluxo regular do SiSU e inclui processos próprios fora dele. O [Edital PRE 16/2026 da UFCG](https://comprov.ufcg.edu.br/component/phocadownload/category/1-graduacao.html?download=608), p. 1, abre seleção administrada pela UFCG depois de esgotada a lista de espera do SiSU 2026, usando vagas que tinham sido ofertadas pelo SiSU. O [Edital 04/2025 da UEPB](https://uepb.edu.br/download/prograd-selecao-por-nota-do-enem-2025-2-edital/), p. 1, também cria seleção própria para vagas não preenchidas no SiSU, mas exige nota do ENEM. O [Edital 10/2026 da UEPB](https://uepb.edu.br/prograd/download/nota-do-ensino-medio-2026-2-edital-10-2026-uepb-prograd/), p. 1, cria seleção por histórico escolar para vagas não preenchidas no SiSU. A [página SiSU+ da UFPB](https://www.prg.ufpb.br/edital/sistema-de-selecao-unificada-sisu-2026-2/) descreve expressamente uma etapa complementar do SiSU; esta já está excluída pelo ADR 0001.

Falta decidir se **a origem das vagas** ou **o fluxo efetivo de inscrição/seleção** determina o enquadramento quando um novo edital próprio usa vagas remanescentes. O título “vagas remanescentes” não resolve a questão.

## Alternativas consideradas

1. Incluir apenas quando o edital instituir inscrição e classificação autônomas, após o encerramento da lista do SiSU. Registrar a origem das vagas em campo próprio e manter SiSU+ excluído.
2. Excluir sempre que as vagas se originarem do SiSU, mesmo que exista novo edital independente.
3. Manter esses casos em revisão até haver critério explícito para a origem das vagas e o fluxo efetivo.

## Decisão

O usuário escolheu em 2026-11-02 a alternativa 3 para o piloto. Uma seleção própria que preencha vagas remanescentes após o encerramento da lista do SiSU recebe `PENDING_REVIEW`, mesmo quando tem inscrição e classificação independentes. Não aparece no catálogo público sem decisão humana documentada para aquele processo. O fluxo regular do SiSU e o SiSU+ continuam `OUT_OF_SCOPE`. A decisão evita inferir elegibilidade apenas pelo título, pela origem da vaga ou pelo uso de ENEM.

## Impacto e teste de aceite

Os rótulos de escopo de `UFCG-02`, `UEPB-01` e `UEPB-04` são `PENDING_REVIEW`; os processos não podem ser publicados. Testar separadamente: chamada/lista do SiSU, SiSU+, edital próprio para remanescentes com inscrição e classificação independentes e anúncio sem edital. Documentar o critério no glossário do passo 005 e aplicar no classificador do passo 043.
