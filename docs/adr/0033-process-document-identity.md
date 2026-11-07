# ADR 0033 — associação de documentos a processos

- Estado: PROPOSTO no passo 054.
- Data: 2026-11-07 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.2, 6–6.1; roteiro 054; schema Prisma.

## Contexto

O schema guarda documentos por URL e versão. A relação com processos ocorre
indiretamente por evidências e revisões; não existe vínculo explícito entre um
processo e seu documento principal. O roteiro exige reconciliar URL nova e
replay sem fundir editais por semelhança de curso. Um mesmo hash pode aparecer
em mais de uma URL ou num arquivo que mencione vários processos.

## Alternativas

1. Adicionar vínculo tipado `process_documents`, com papel de documento principal,
   anexo, cronograma e retificação, preservando o ID da versão e a procedência.
2. Inferir o documento principal por evidências ou revisões a cada consulta.

## Decisão provisória para o passo 054

O reconciliador puro usa instituição + código de edital + ano quando completos.
Identidade exata de documento principal pode vincular extração incompleta sem
conflito. Hash igual sem identidade de edital conclusiva gera revisão assistida,
sem criação automática de duplicata. Código de edital conflitante ou múltiplos
candidatos também geram revisão. A persistência do vínculo principal fica
pendente de decisão sobre a tabela de associação e não é inferida a partir de
nome de curso ou URL parecida.
