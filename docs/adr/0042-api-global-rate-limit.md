# ADR 0042: limite global de requisicoes da API

- Status: aceito pelo usuario em 2026-11-11
- Passo: 076
- Data: 2026-11-11

## Contexto

O passo 076 exige cobertura automatizada contra abuso de endpoints, mas a arquitetura nao define limites gerais, janela, identificador do cliente nem comportamento atras de proxy. O sistema ja aplica cooldown Redis atomico de 60 segundos por host exato em `POST /admin/sources/:id/run` (ADR 0038). A API nao configura atualmente proxy confiavel, portanto `X-Forwarded-For` nao e uma origem de identidade segura.

## Decisao

Aplicar janela fixa de 60 segundos com incremento atomico Redis. Limitar GETs publicos a 120 por minuto por IP do socket e mutacoes administrativas (`POST`, `PUT`, `PATCH`, `DELETE`) a 30 por minuto por principal autenticado, identificado por `issuer + subject`. O IP e o principal sao submetidos a SHA-256 antes de compor a chave Redis. `X-Forwarded-For` e ignorado enquanto nao houver proxy confiavel explicitamente configurado. Ao exceder, responder HTTP 429 com `Retry-After`; indisponibilidade/inconsistencia do Redis falha fechada em HTTP 503. Health checks e rotas administrativas/internas nao consomem o bucket publico. O cooldown de 60 segundos por host do ADR 0038 permanece independente.

## Consequencias

- Enderecos de cliente e principals nao aparecem em claro nas chaves Redis.
- Varios processos da API compartilham os mesmos buckets via Redis.
- Sem proxy confiavel configurado, clientes atras de um proxy compartilham o IP do socket observado, portanto a camada de ingresso deve preservar uma topologia apropriada.
- O abuso repetido do endpoint manual de coleta continua tambem limitado pelo cooldown por host exato do ADR 0038.
