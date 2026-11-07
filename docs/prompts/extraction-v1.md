# Prompt de extração `extraction-v1`

O texto enviado ao adapter está versionado em
`apps/api/src/modules/ai/extractor/extraction-prompt.v1.ts`. O schema de saída
é `docs/contracts/extraction-v1.json`; o worker valida também o contrato Zod e
a presença literal de cada citação no documento de entrada.

## Regras

- Extraia somente fatos presentes nos trechos oficiais fornecidos.
- Preencha todas as propriedades do contrato; use `null` para ausências e
  ambiguidades, inclusive listas desconhecidas.
- Não complete ano, hora, fuso, vagas, taxa, requisito ou ENEM por suposição.
- Diferencie taxa de inscrição de mensalidade e ENEM de fluxo regular do SiSU.
- Cite documento, página ou seção e trecho curto para cada campo não nulo.
- Preserve ofertas, reservas e documentos separados.
- Copie `institution_id` do contexto; não o deduza do texto.

Uma saída estruturalmente válida ainda pode ser marcada `PENDING_REVIEW` se a
citação não estiver no trecho recebido ou não sustentar o valor. Este prompt
não autoriza publicação. Nenhum fornecedor ou modelo externo está ativo neste
passo.
