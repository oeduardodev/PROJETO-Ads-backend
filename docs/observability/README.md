# Observabilidade

## Logs e correlação

API e worker emitem uma linha JSON por evento. A API valida `X-Request-Id` como UUID ou gera um identificador novo, devolve-o no header e usa o mesmo valor nas decisões administrativas/auditoria. A resposta CORS expõe apenas esse header adicional. Logs de requests usam método, rota registrada, status e duração; não incluem query string, IP, body, token, justificativa, e-mail ou URL completa.

Eventos de coleta carregam `sourceId` e `crawlRunId`; observações acrescentam `discoveredUrlId` e SHA-256 da URL; snapshots carregam `documentId`; decisões humanas carregam `processId`, ação, versão de revisão e request ID. A cadeia persistida continua sendo a fonte de verdade para proveniência. O hash de URL ajuda a correlacionar log sem imprimir caminho ou parâmetros.

## Métricas

`GET /api/v1/internal/metrics` retorna formato Prometheus e exige identidade OIDC mapeada como `CURATOR` ou `ADMIN`. O scrape consulta metadados agregados de fonte, observações das últimas 24 horas, falhas recentes e contagens BullMQ por fila/estado. Contadores do processo registram requests, filas, decisões, snapshots, coletas e uso/falha de IA. Não são emitidos nomes, URLs, conteúdo de edital, usuários ou endereços de rede.

Prometheus não deve ser exposto à internet. Um scraper deve usar credencial de serviço provisionada pelo operador e receber a role de leitura apropriada; autenticação e conectividade do scraper precisam ser configuradas na homologaçao. Regras iniciais estão em `infra/monitoring/alerts.yml`. Nenhum destino de notificação é configurado neste repositório.

Os contadores em memória reiniciam com o processo. Medidas persistentes de fonte derivam de Postgres; contagens de fila consultam BullMQ. Métricas de IA do worker só ficam nos logs estruturados enquanto não houver exporter/collector compartilhado. `source_failed_crawl_runs_24h` é contexto de painel; os alertas seguem o ADR 0023: três falhas consecutivas (métrica `source_failure_streak`) ou duas frequências sem sucesso. O alerta de atraso usa idade da última coleta bem-sucedida e frequência configurada.

## Limites conhecidos

- Os produtores BullMQ existem, mas consumidores de fetch/extract ainda não estão integrados. Não há evidência de rastreamento vivo ponta a ponta; os IDs e relações persistidas permitem auditar quando o pipeline consumidor for conectado.
- Alertas são regras de avaliação, não notificações enviadas. Destino, retenção de logs, dashboards e exporter de métricas do worker dependem da infraestrutura de homologaçao.
- O alerta de zero candidatos continua sendo aviso de revisão, não incidente automático, conforme ADR 0023.
