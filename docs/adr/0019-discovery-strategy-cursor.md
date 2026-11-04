# ADR 0019 — persistência de cursor das estratégias de descoberta

- Estado: ACEITO pelo usuário no passo 035.
- Data: 2026-11-04 (America/Sao_Paulo).
- Referências: arquitetura §§ 4.2 e 7.2; roteiro 035; `apps/api/prisma/schema.prisma`.

## Contexto

O passo 035 exige execução incremental de RSS e sitemap e persistência de cursor e data da execução. A arquitetura descreve a descoberta incremental, mas não define a representação ou o local de persistência. O modelo `Source` já possui tipo da fonte, `lastCheckedAt` e metadados HTTP, mas não tem cursor de estratégia nem data própria de execução. Reutilizar `lastCheckedAt` confundiria a verificação agendada da fonte com a execução específica do parser.

## Alternativas

1. **Estado versionado em `Source` (recomendado):** adicionar JSONB opcional para cursor de estratégia e timestamp próprio `strategyLastExecutedAt`. O tipo da fonte determina o parser; o JSON fica versionado e validado pela aplicação. Mantém o estado junto à única estratégia configurada por fonte.
2. **Tabela `DiscoveryStrategyState` 1:1:** guardar `sourceId`, cursor JSONB, timestamp de execução e versão em tabela filha. Separa estado operacional do cadastro, mas adiciona relação e migration sem necessidade atual de múltiplos estados por fonte.

## Decisão

Adicionar em `Source` um campo JSONB opcional para cursor versionado e um timestamp próprio `strategyLastExecutedAt`. Os parsers validam a versão e o tipo do cursor antes de usá-lo. O cursor RSS contém as chaves dos itens presentes no último feed processado (GUID/ID junto à URL canônica, ou a URL como fallback); o cursor sitemap contém as URLs canônicas presentes no último sitemap. A primeira execução emite os itens allowlisted encontrados; execuções seguintes emitem somente itens ausentes do cursor anterior. A gravação do cursor e da data é feita em uma atualização após o processamento bem-sucedido; falhas preservam o cursor anterior para replay.

Decisão do usuário registrada em 2026-11-04.
