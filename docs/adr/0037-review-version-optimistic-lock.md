# ADR 0037: versao monotona para concorrencia nas revisoes

- Status: aceito pelo usuario (delegada a escolha da melhor abordagem)
- Passo: 061
- Data: 2026-11-08

## Contexto

O passo 061 requer optimistic locking para aprovar, rejeitar, corrigir e ocultar um processo. O modelo atual nao possui `updatedAt` nem contador de revisao. Comparar apenas o estado de ingestao/publicacao nao detecta correcoes concorrentes que preservem o mesmo estado.

## Decisao

Adicionar `reviewVersion Int @default(0)` ao processo. Cada mutacao administrativa envia a versao lida pelo revisor; a transacao escreve com condicao `id + reviewVersion esperada`, incrementa a versao e registra decisao/auditoria atomicas. Versao divergente retorna HTTP 409 e nao grava nenhuma mudanca. Toda mutacao da linha do processo feita por comando de revisao, inclusive correcao sem transicao, incrementa o mesmo contador.

## Alternativas

- Comparar apenas estados: nao detecta duas correcoes concorrentes que deixem o status inalterado.
- `updatedAt`: menos explicito, depende de todo escritor atualizar o campo e tem precisao inferior a um contador inteiro para esse contrato.
- Versao por campo: adiada; aumenta complexidade sem requisito de merge parcial concorrente.

## Consequencias

- O contrato dos comandos administrativos requer `expectedReviewVersion`.
- O cliente precisa recarregar o detalhe quando receber conflito.
- A migration `20261108140000_process_review_version` e as mutacoes deste passo implementam a decisao. Nenhum banco de producao foi alterado.
