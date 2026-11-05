# ADR 0025 — OCR sob demanda e orçamento

- Estado: ACEITO; escolha explícita do usuário no passo 044.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.2, 7.2 e 10.1; roteiro 044; ADRs 0008, 0016 e 0024.

## Contexto

O roteiro exige OCR somente após texto PDF convencional insuficiente, com fila, orçamento e limite de páginas. A arquitetura não define motor, idioma, limiar, unidade de orçamento nem se OCR compartilha `document.extract`. O worker atual registra essa fila, mas ainda não consome documentos. Não há executável Tesseract no ambiente local. Snapshots oficiais continuam bloqueados pelo ADR 0008.

## Alternativas

1. **OCR local e fila dedicada (escolhida):** renderizar páginas por PDF.js, reconhecer com Tesseract.js 7.0.0 e o pacote de modelo português `@tesseract.js-data/por` 1.0.0, sem CDN em execução. Criar `document.ocr` para limitar concorrência e observar falhas separadamente. Candidatar somente páginas com imagem e menos de 40 caracteres úteis extraídos; limite configurável de 5 páginas por documento e orçamento global diário de páginas em UTC, iniciado em zero até ativação explícita. IDs de job e reservas de identidade são estáveis; repetições da mesma página não gastam o orçamento novamente.
2. **OCR local na fila `document.extract`:** mesmo motor e elegibilidade, com um único tipo de job. Compartilha concorrência e falhas com a extração sem OCR, tornando o trabalho pesado menos isolado.
3. **Serviço externo ou executável nativo:** exige decisão adicional de transferência de documentos, credenciais ou instalação do binário e seus modelos. Não é necessário para validar uma fixture sintética neste passo.

## Decisão e consequências

OCR processa bytes já autorizados, não busca URLs e não publica conteúdo. Páginas textuais não devem consumir orçamento. O resultado preserva a página física e a indicação do motor; a identidade do PDF é mantida no payload por `documentId` e SHA-256. Conteúdo OCR segue para revisão humana. O orçamento e o limite de páginas são guardas operacionais, não prova de completude. A execução aplica timeout, limite de pixels e limites de bytes/páginas; PDF.js roda no processo do worker e o limite de memória do container segue obrigatório em produção. As reservas de identidade não expiram; novas execuções dos mesmos bytes exigem mudança explícita da versão do pipeline. O trabalho com PDFs oficiais permanece desativado até revisão de licença e retenção por fonte.

## Referências técnicas

- [Tesseract.js: worker de OCR para imagens](https://github.com/naptha/tesseract.js/blob/master/docs/api.md).
- [Tesseract.js: configuração de modelo de idioma local](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md).
- [PDF.js: renderização de página](https://mozilla.github.io/pdf.js/examples/index.html).
- [Tesseract: PDFs precisam ser convertidos em imagem para OCR](https://github.com/tesseract-ocr/tessdoc/blob/main/InputFormats.md).
