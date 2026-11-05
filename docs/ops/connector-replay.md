# Replay offline e regressão de conectores

Este procedimento valida parsers e gravação idempotente sem requisições a fontes oficiais. As fixtures são sintéticas e podem referenciar apenas URLs já existentes no manifesto revisado; não são snapshots nem autorizam coleta.

## Antes de reproduzir

1. Confirme URL, host exato, termos, robots, licença e estado da fonte na matriz e na política de coleta.
2. Somente uma fonte `ACTIVE` e autorizada poderia ser coletada pelo worker. No piloto atual as quatro fontes permanecem `DRAFT` e `collectionAllowed=false`; use fixtures locais e não chame fontes reais.
3. Mantenha o resultado como candidato. Uma fixture ou URL do manifesto não é evidência para publicação.

## Validar uma alteração de layout

1. Salve um novo harness sintético versionado em `test/fixtures/discovery/`; preserve a versão anterior para regressão.
2. Garanta que cada URL de edital venha do manifesto revisado, host exato autorizado e texto-âncora coerente. Inclua links repetidos/canônicos, host fora da lista e links de exclusão explícita quando o caso exigir.
3. Rode `corepack pnpm build`, depois `node --test test/institution-connectors.test.mjs test/html-link-parser.test.mjs test/responsible-http.test.mjs`.
4. Compare a lista canônica, a origem, o texto-âncora e o resultado em dois replays do mesmo HTML. Repetição do mesmo `crawlRunId` não cria nova observação nem altera contadores/timestamps (ADR 0022); uma nova execução pode contar uma nova observação.

## Falha, indisponibilidade ou bloqueio

- HTTP 401/403, `robots.txt` bloqueado, CAPTCHA, autenticação ou host/redirect fora da allowlist: interrompa; não tente contornar nem parsear um corpo de erro como página de editais. Encaminhe a fonte para revisão manual.
- Rede indisponível e 429/5xx: use apenas o backoff/retries cobertos por `ResponsibleHttpClient`. A falha final não gera candidatos e deve permanecer visível na execução/fila; retries esgotados não autorizam nova coleta manual sem revisão.
- Layout válido com zero candidatos: emitir aviso de revisão, sem classificar automaticamente a fonte como quebrada nem publicar qualquer registro.
- Falha do parser: resultado `FAILED` com lista vazia; nenhuma escrita em processo/oferta deve ocorrer. A API e o worker são processos separados. `corepack pnpm test:e2e` verifica que a API ainda serve `/health` quando a readiness das dependências falha.

## Alerta operacional (ADR 0023)

Para fontes ativas e autorizadas no início da execução: aviso após a primeira falha final; alerta após três falhas finais consecutivas ou duas frequências configuradas desde o último sucesso. Sem sucesso anterior, o limiar é três falhas finais consecutivas. Zero candidatos em resposta bem-sucedida é apenas aviso para revisão. O alerta é resolvido por uma coleta bem-sucedida. Fontes `DRAFT`, `BLOCKED` ou `PAUSED` não geram novas avaliações de atraso; preserve um alerta da coleta que provocou a pausa até revisão humana.

O ADR fixa os limiares, mas esta etapa não integra um emissor/serviço de alertas; operadores devem usar os campos de falha e `lastSuccessAt` até a instrumentação ser conectada. Não incluir HTML, credenciais ou dados pessoais no alerta.

## Comandos de regressão

```sh
corepack pnpm test
corepack pnpm test:e2e
```

A integração de repositório requer `TEST_DATABASE_URL` apontando exclusivamente para PostgreSQL local descartável e migrations locais já aplicadas. Para executar somente o caso de replay, use `node --test --test-concurrency=1 test/integration/discovery.test.mjs`. Nunca direcione estes testes a banco de produção.
