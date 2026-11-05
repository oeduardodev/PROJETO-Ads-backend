# Extração convencional de texto PDF

O passo 042 usa `pdfjs-dist` 6.5.438 diretamente, conforme o ADR 0024. `parsePdfText` recebe bytes em memória e limites explícitos de bytes, páginas e itens de texto por página. Os recursos CMap, fontes e WASM vêm do pacote local; o parser não busca URLs nem persiste conteúdo.

Cada página preserva o número físico (começando em 1), linhas em ordem visual aproximada, segmentos com coordenadas do PDF e candidatos a título em caixa alta. Esses candidatos são pistas para revisão, não seções confirmadas. As métricas de qualidade contam caracteres úteis, caracteres de substituição e páginas sem camada de texto. Página sem texto continua no resultado para OCR posterior, sem conteúdo inferido.

A fixture `test/fixtures/documents/pdf/table-schedule.v1.pdf` é sintética e pode ser regenerada com `python test/fixtures/documents/pdf/generate_table_schedule.py`. Ela contém uma tabela, um cronograma, um anexo e uma página vazia para verificar paginação, colunas e sinalização de texto ausente. A recomposição de linhas é conservadora e foi verificada nessa fixture; PDFs rotacionados, escritos em múltiplas direções e tabelas complexas exigem avaliação com corpus autorizado antes do uso operacional.

O parser ainda não está conectado ao worker ou a fontes reais. O isolamento de tempo/memória para PDFs não confiáveis e a política de snapshots oficiais continuam pendentes conforme a arquitetura § 10.1 e o ADR 0008.
