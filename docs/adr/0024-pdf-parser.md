# ADR 0024 — parser convencional de PDF

- Estado: ACEITO; escolha explícita do usuário no passo 042.
- Data: 2026-11-05 (America/Sao_Paulo).
- Referências: arquitetura §§ 5.2, 6, 7.2 e 10.1; roteiro 042.

## Contexto

O roteiro exige texto por página, seções identificáveis, qualidade mensurável e layout mínimo para evidências, inclusive tabela e cronograma. A arquitetura não escolhe a biblioteca PDF. O parser recebe bytes já tipificados pelo coletor do passo 041; neste passo ele não busca URLs, grava snapshots ou publica dados.

## Alternativas

1. **PDF.js direto (`pdfjs-dist`, escolhida):** expõe página, itens de texto e coordenadas. Permite preservar a origem de cada linha e segmentar colunas sem depender de uma abstração de texto corrido. Exige reconstrução conservadora de linhas no projeto.
2. **`pdf-parse`:** fornece funções prontas de texto e tabela; simplifica a integração inicial, com menor controle direto sobre a geometria de cada item usada nas evidências.

## Decisão e consequências

Usar `pdfjs-dist` 6.5.438 diretamente, fixado no lockfile. Esta versão exige Node ≥22.13; o mínimo do projeto foi atualizado para acompanhar o requisito. Processar somente bytes em memória; manter o número físico da página, texto e coordenadas de linhas/segmentos. Preservar títulos de seções como texto da página e sinalizar candidatos a título sem tratá-los como campos verificados. Retornar métricas objetivas de qualidade da camada de texto (caracteres úteis e páginas sem texto), sem inventar conteúdo ausente. OCR e critérios para acioná-lo pertencem a passo posterior.

A saída do parser é intermediária para evidências: não valida elegibilidade, não interpreta prazos e não produz publicação. A fixture de tabela e cronograma será sintética. A integração com worker e o isolamento operacional de tempo/memória continuam sujeitos aos passos do fluxo de extração; o parser não fica conectado a fontes reais neste passo.

## Referências da decisão

- [API PDF.js: itens de texto e transformações por página](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html).
- [Exemplo oficial de uso em Node](https://github.com/mozilla/pdf.js/blob/master/examples/node/getinfo.mjs).
- [API de texto e tabela do `pdf-parse`](https://github.com/mehmet-kozan/pdf-parse).
