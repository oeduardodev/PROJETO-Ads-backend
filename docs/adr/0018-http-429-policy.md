# ADR 0018 — tratamento de HTTP 429 no cliente de coleta

- Estado: ACEITO pelo usuário no passo 033.
- Data: 2026-11-04 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2 e 10.1; roteiro 033; `docs/research/crawl-policy.md`.

## Contexto

A arquitetura manda aplicar backoff em respostas `429` e `5xx`. A política de pesquisa do piloto orienta pausar a fonte e revisá-la quando receber `403` ou `429`. A diferença determina se o cliente repete uma resposta de limite de taxa ou se exige revisão humana imediatamente.

## Alternativas

1. **Backoff limitado:** em `429`, respeitar `Retry-After` quando válido e repetir com backoff exponencial e jitter por até três tentativas. Se esgotadas, pausar a fonte para revisão humana. `403`, bloqueio de `robots.txt` e autenticação não têm retry e exigem pausa/revisão imediata.
2. **Pausa imediata:** no primeiro `429`, pausar a fonte para revisão humana, sem repetir automaticamente. Backoff fica reservado a `5xx`.

## Decisão

Usar a alternativa 1. Respeitar `Retry-After` quando válido e repetir com backoff exponencial e jitter, por até três tentativas no cliente HTTP. Se esgotadas, propagar falha com status e `Retry-After` para que o consumidor do job pause a fonte e exija revisão humana. Respostas `403`, bloqueio de `robots.txt` e autenticação não são repetidas e exigem revisão.

Decisão do usuário registrada em 2026-11-04.
