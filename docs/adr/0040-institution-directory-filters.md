# ADR 0040: escopo dos filtros do diretório público

- Status: aceito pelo usuário
- Passo: 073
- Data: 2026-11-11

## Contexto

O passo 073 exige filtros simples para `/instituicoes`. A arquitetura §§ 8 e 9.1 define `GET /institutions` e o diretório, mas o contrato OpenAPI atual só permite paginação. A API retorna cadastros verificados, campi individualmente verificados e metadados reais de fontes ativas. Filtrar apenas uma página no browser pode ocultar correspondências que estejam em outras páginas.

## Opção recomendada — filtro no servidor

Estender `GET /institutions` com `q`, `uf`, `city` e `jurisdiction`. `q` pesquisa nome/sigla; UF e cidade correspondem somente a campi verificados; jurisdição aceita `FEDERAL` ou `ESTADUAL`. Aplicar filtros antes da paginação, preservar os parâmetros na URL e regenerar o client a partir do OpenAPI. Manter o recorte de publicação e de cobertura definido pelo serviço atual.

## Alternativa — filtro na página carregada

Manter o contrato atual e filtrar no browser apenas os itens recebidos para a página. A interface teria de dizer explicitamente que os resultados do filtro se limitam à página carregada; uma correspondência ausente não significaria ausência no diretório completo.

## Aceite

O usuário aprovou filtros server-side para abranger o catálogo completo antes da paginação. Implementar os parâmetros `q`, `uf`, `city` e `jurisdiction`; UF e cidade correspondem somente a campi verificados. Não alterar o recorte de publicação existente.
