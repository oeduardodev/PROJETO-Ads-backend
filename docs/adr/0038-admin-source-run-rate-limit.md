# ADR 0038: limite de disparos manuais de fontes

- Status: aceito pelo usuario
- Passo: 062
- Data: 2026-11-08

## Contexto

O roteiro do passo 062 exige que `POST /admin/sources/:id/run` tenha rate limit. A arquitetura determina limite por dominio para coleta, mas nao fixa a janela, se o limite se aplica por usuario ou por host, nem como varias instancias devem compartilhar o estado. O endpoint precisa manter o limite mesmo com curadores diferentes e API horizontalmente escalada.

## Decisao

Aplicar cooldown atomico Redis de 60 segundos por host exato da fonte, compartilhado entre curadores e instancias. A duracao e configuravel por `ADMIN_SOURCE_RUN_COOLDOWN_SECONDS`, com padrao 60 e valor minimo de 1. A operacao manual e admitida somente para fonte ACTIVE, ligada a dominio exato com coleta autorizada e revisao registrada; fontes BLOCKED sao recusadas. Durante o cooldown, responder HTTP 429 com `Retry-After` calculado pelo TTL. Falha do Redis deve falhar fechada e retornar indisponibilidade, nunca desabilitar silenciosamente o limite.

## Consequencias

- O limite impede que execucoes manuais concorrentes sobrecarreguem o mesmo host.
- Curadores compartilham o mesmo limite e nao podem contorná-lo trocando de usuario.
- O estado e efemero; reinicializacao/expiracao natural do Redis encerra o cooldown.
- A resposta 429 comunica quando o host pode ser novamente acionado.

## Aceite

O usuario aprovou explicitamente o cooldown Redis atomico configuravel, com padrao de 60 segundos por host exato e compartilhado entre curadores e instancias.
