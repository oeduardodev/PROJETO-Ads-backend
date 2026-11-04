# ADR 0017 — política de agendamento de fontes

- Estado: ACEITO; escolha explícita do usuário no passo 032.
- Data: 2026-11-04 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2–4.3, 7.2 e 11.2; roteiro 032.

## Contexto

A arquitetura e o schema definem frequência, prioridade, estado e saúde da
fonte, além de exigir concorrência por domínio. Não especificam quais estados
podem ser agendados, como formar uma janela idempotente, ou como contar a
concorrência enquanto os jobs ainda aguardam na fila.

## Alternativas

1. **Saúde conservadora (recomendada):** agendar somente fontes `ACTIVE` com
   domínio exato revisado e coleta autorizada; excluir `DRAFT`, `PAUSED` e
   `BLOCKED`; manter `DEGRADED` elegível com prioridade inferior a
   `HEALTHY`/`UNKNOWN`.
2. **Somente fontes saudáveis:** também excluir `DEGRADED` até revisão humana.
   Isso reduz tráfego em fonte instável, mas pode deixar de detectar uma
   recuperação.

Para janela, uma alternativa seria usar o horário de cada tick, que cria novos
IDs ao repetir o scheduler; a outra é derivar o ID da janela de frequência,
permitindo que vários processos e ticks identifiquem a mesma janela.

## Decisão

O usuário aceitou a alternativa 1 e a janela UTC determinística. O scheduler:

- agenda apenas fontes `ACTIVE`, com `reviewed_at` e `collection_allowed` no
  domínio exato; `DRAFT`, `PAUSED` e `BLOCKED` não são elegíveis;
- mantém `DEGRADED` elegível, mas ordena `HEALTHY`/`UNKNOWN` primeiro e dá
  prioridade BullMQ inferior às fontes degradadas; menor prioridade numérica
  cadastrada continua tendo precedência;
- considera a fonte vencida quando nunca foi verificada ou quando decorreu
  `frequency_minutes` desde `last_checked_at`;
- deriva `schedule_version` do minuto UTC inicial da janela de frequência. Para
  fontes verificadas, as janelas são ancoradas em `last_checked_at`; para as
  nunca verificadas, usam intervalos UTC. Um único tick representa a janela
  atual, sem replay de cada janela perdida;
- usa lock global Redis com token, TTL de 30 segundos, renovação a cada 10
  segundos e liberação condicional ao token proprietário;
- limita jobs `source.refresh` pendentes/ativos por host exato com
  `CRAWL_CONCURRENCY` (padrão 1), incluindo jobs em fila para não exceder o
  limite entre ticks.

O cálculo de prioridade limita a faixa de prioridade configurada à escala
BullMQ e reserva uma faixa inferior para fontes `DEGRADED`. O estado de saúde,
status e autorização não são alterados automaticamente; a elegibilidade é
reavaliada em cada execução. Este passo apenas agenda jobs: não inicia HTTP,
coleta ou publicação.
