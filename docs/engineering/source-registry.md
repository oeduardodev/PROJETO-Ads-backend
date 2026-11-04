# Registro de fontes

O passo 016 cria `allowed_domains` e `sources` por instituição. Um host permitido corresponde **somente ao host exato** (ADR 0006). O cadastro exige URL HTTPS com host DNS público, sem credenciais ou porta customizada; a URL de evidência do host precisa usar esse mesmo host. A fonte referencia a instituição e a entrada de domínio, e as FKs impedem associação entre instituições diferentes.

Domínios começam com `collection_allowed = false` e sem `reviewed_at`; fontes começam em `DRAFT`, com saúde `UNKNOWN`. O cadastro não inicia HTTP, Playwright, jobs ou publicação. Antes de ativar um domínio/fonte, um curador deve registrar a revisão de acesso, licença, retenção e política de coleta conforme `docs/research/crawl-policy.md`. A checagem DNS e de redirecionamentos para evitar redes privadas pertence ao coletor futuro, na execução de cada requisição.

Frequência padrão: 1440 minutos; prioridade padrão: 100. Ambas exigem valores válidos no repositório e no banco. `etag`, `last_modified`, último check, último sucesso e saúde são campos de execução, ainda vazios. `docs/research/source-matrix.csv` contém candidatos pesquisados, não uma autorização para crawling.


O scheduler só consulta fontes `ACTIVE` com domínio exato revisado e coleta autorizada. Ele não agenda fontes `DRAFT`, `PAUSED` ou `BLOCKED`; fontes `DEGRADED` continuam elegíveis, com prioridade inferior. Cada fonte fica elegível quando `last_checked_at` está vazio ou quando decorreu sua `frequency_minutes`. O scheduler limita jobs pendentes/ativos por host exato usando `CRAWL_CONCURRENCY`, cujo padrão é 1. Nenhuma fonte é ativada por esse processo e nenhuma requisição HTTP é feita nesta etapa.
