# Desempenho e carga de referência

## Busca pública

O alvo inicial da arquitetura é p95 abaixo de 500 ms para endpoints indexados sob uma carga de referência declarada. O harness `test/performance/public-search.mjs` mede a busca pública completa, incluindo consultas Prisma, checagem dos hosts oficiais, cálculo do estado, ordenação e paginação. O banco deve ser dedicado e descartável; o script aceita somente `127.0.0.1`/`localhost`/`::1`, porta `5433`, banco `alem_perf`. Ele não executa migrations.

Comando, após aplicar as migrations no banco local isolado:

```powershell
$env:PERFORMANCE_DATABASE_URL = 'postgresql://postgres:local@127.0.0.1:5433/alem_perf?schema=public'
corepack pnpm perf:public-search
```

O harness cria um corpus determinístico de 2.000 processos sintéticos, 2.000 ofertas, 5 instituições e 2.000 decisões de revisão. Os hosts `.example.com` são apenas sentinelas de fixture em um banco isolado; o teste não acessa a Web. Reexecuções aceitam somente esse corpus ou um banco vazio. A execução faz 30 aquecimentos e mede 200 buscas, concorrência 8, `page_size=20`, além de coletar `EXPLAIN (ANALYZE, BUFFERS)` sobre as condições de elegibilidade do catálogo. A saída JSON informa p50/p95/máximo e o plano SQL.

## Resultado registrado

Medição local em 2026-11-11, Windows 11, AMD Ryzen 7 5700G (8 núcleos), 16 GiB RAM, PostgreSQL 18 local, Node 24, 5 instituições/2.000 processos publicados/2.000 ofertas, catálogo integral em memória, página 20, 30 aquecimentos, 200 amostras a concorrência 8:

| Medida | Resultado |
| --- | ---: |
| Busca p50 | 166,78 ms |
| Busca p95 | 237,74 ms |
| Máximo observado | 271,57 ms |
| Execução SQL representativa | 1,40 ms |
| Limite validado | `page_size` até 100; consultas inválidas acima do limite rejeitadas pelos testes existentes |

O plano representativo foi `Hash Join`, com 77 blocos compartilhados acessados. Uma execução preliminar do mesmo ensaio escolheu varredura sequencial para os 2.000 registros; para este corpus pequeno em que todos satisfazem os predicados, não foi adicionado índice especulativo. O número SQL é da consulta representativa de elegibilidade, não a soma de todas as consultas Prisma. A maior parte do tempo medido ocorreu fora da execução SQL, na hidratação das relações e no pós-processamento síncrono do serviço. Não há cache adicional: a busca depende de estado temporal de janelas, e esta carga local não demonstrou benefício que justificasse invalidar/expirar cache de catálogo.

O p95 ficou abaixo de 500 ms neste cenário local. Isso não é garantia para produção: hardware, rede, volume real, distribuição de filtros, cache frio e competição por conexões diferem. A consulta carrega todos os processos elegíveis antes de aplicar paginação em memória; catálogos substancialmente maiores exigem nova medição e possivelmente paginação/ordenação em SQL, preservando a validação de host exato e os estados conservadores de prazo.

## Limites de orçamento e concorrência

Chamadas externas de IA permanecem desativadas por padrão (`AI_MAX_TOKENS_PER_DOCUMENT=0`) e têm limite cumulativo por documento em Redis, conforme ADR aprovado; os testes do provider verificam o limite e que consultas públicas não dependem de IA. O crawler tem concorrência configurável, padrão 1, e a coleta aplica limites por host e backoff; não há consumidor ativo para um teste de carga de jobs completo nesta versão. A carga acima mede apenas a API de busca, sem inferir desempenho de crawler, IA ou staging.

## Repetição e isolamento

Use um PostgreSQL efêmero com as migrations da aplicação aplicadas previamente. Nunca forneça URL de staging ou produção: o harness falha antes de conectar se host, porta ou nome não corresponderem ao banco local dedicado. Depois de medir, desligue e remova apenas o diretório temporário criado para esse ensaio.
