# OCR sob demanda

O fallback recebe bytes de PDF obtidos por um fluxo já autorizado. Ele só
considera páginas com imagem e menos de 40 caracteres úteis na camada de texto
extraída. Páginas com texto suficiente não são renderizadas nem enfileiradas.
Esse limiar seleciona trabalho para revisão; não declara que um documento seja
ilegível ou completo.

O produtor BullMQ usa a fila separada `document.ocr`. Cada job contém apenas
`documentId`, SHA-256, página física e versão do pipeline. O ID é estável por
documento, hash, página e versão. O resultado mantém o texto reconhecido,
confiança do Tesseract, número da página e versão do motor; ele é texto
derivado automaticamente e não constitui evidência revisada ou conteúdo
publicável. A ligação do consumidor à extração documental será feita na etapa
de integração do worker.

`OCR_DAILY_PAGE_BUDGET` define o número global de páginas novas reservadas por
dia UTC; o padrão é `0`, que desativa novos jobs OCR. `OCR_MAX_PAGES_PER_DOCUMENT`
define o máximo considerado por documento; o padrão é `5`. O Redis reserva uma
identidade de página atomicamente junto com o contador diário. Uma repetição da
mesma identidade não gasta o orçamento novamente e pode reenfileirar o mesmo ID
estável. A identidade é mantida sem expiração; mudar a versão do pipeline é a
forma explícita de gerar um novo trabalho para os mesmos bytes.

O reconhecimento usa `pdfjs-dist` para renderizar uma página a 2x e
`@napi-rs/canvas` para gerar PNG em memória. `tesseract.js` 7.0.0 carrega o
modelo português `@tesseract.js-data/por` 1.0.0 do pacote local com cache
desativado. O código não define URL de modelo nem usa CDN. O PDF é limitado por
`MAX_PDF_BYTES`, contagem de páginas, 18 milhões de pixels renderizados por
página e timeout de 60 segundos. O OCR roda no worker thread do Tesseract; o
renderizador PDF.js ainda está no processo do consumidor, então o limite de
memória do container continua necessário para produção.

Fixtures de OCR são imagens sintéticas geradas localmente e não representam
editais ou fontes oficiais. Crawling, armazenamento de snapshots oficiais,
ativação de quota diferente de zero e publicação de texto reconhecido exigem
as revisões humanas previstas nos ADRs 0008 e 0025.
