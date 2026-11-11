# Threat model — passo 076

- Estado: revisão inicial baseada no código e nos testes locais; não é certificação de segurança.
- Escopo: API NestJS e worker de coleta, dados públicos/revisados, URLs oficiais, snapshots, autenticação administrativa e configuração operacional.
- Ambiente: desenvolvimento e testes locais. Nenhuma produção foi consultada ou alterada.

## Ativos e limites de confiança

- Credenciais de Postgres/Redis, segredo dos provedores de busca/IA e configuração do provedor OIDC.
- Mapeamento `issuer + subject` para papéis administrativos e trilha de auditoria.
- URLs permitidas, conteúdo HTML/PDF obtido de terceiros, snapshots, dados de processos publicados e proveniência.
- Entrada externa cruza a API/worker; páginas, redirects, DNS, HTML e PDF são dados não confiáveis. O worker grava somente depois de URL, host, política, MIME e limite de bytes serem verificados.
- O bundle Angular contém somente configuração pública; credenciais privadas ficam no ambiente do servidor.

## Ameaças e controles verificados

| Ameaça | Controles atuais | Evidência |
| --- | --- | --- |
| SSRF por URL privada, literal IP, DNS rebinding ou redirect | HTTPS obrigatório; host exato em allowlist revisada; porta/credenciais rejeitadas; cada hop valida host e resolve DNS novamente; qualquer resposta DNS privada bloqueia a conexão; IP resolvido é fixado no socket; redirects só no mesmo host e limitados; robots.txt aplicado | `source-url.test.mjs`, `responsible-http.test.mjs` |
| Arquivo excessivo, MIME forjado ou bytes incompatíveis | Limite de resposta aplicado durante streaming e novamente antes de persistir; MIME detectado nos bytes e comparado ao header/extensão; só HTML/PDF aceitos | `document-fetcher.test.mjs`, `responsible-http.test.mjs` |
| XSS/conteúdo ativo em HTML | HTML é analisado como texto com parse5; tags script/style/noscript e elementos ocultos são descartados; frontend usa interpolação Angular e links externos com `noopener noreferrer` | `html-document-parser.test.mjs`, testes públicos web |
| Acesso administrativo não autorizado | JWT assimétrico, algoritmo permitido, emissor/audience/subject/expiração obrigatórios; JWKS HTTPS; cada conta precisa de `AdminUser` mapeado a papel; guards protegem rotas; configuração parcial falha sem habilitar acesso | `auth-token.test.mjs`, `admin-review-commands.test.mjs`, `health.test.mjs` |
| Leitura cross-origin ou execução/embedding indevido de respostas API | CORS exige origens HTTP(S) explícitas e exatas; middleware adiciona CSP sem conteúdo ativo, `nosniff`, frame denial, referrer policy e permissions policy; HSTS não é emitido pela API HTTP local e deve ser tratado no terminador TLS | `config.test.mjs`, `security-headers.test.mjs`, `health.test.mjs` |
| Exposição de credenciais/dados internos por erro | Resposta pública de erro usa mensagem genérica, status estável e request ID; detalhes internos ficam em log reduzido; verificações não incluem body, token ou URL com credencial | `health.test.mjs`, `api-exception.filter.ts` |
| Coleta manual repetida ou uso externo excessivo | Cooldown distribuído Redis de 60 s por host exato no disparo manual; quotas de busca e IA são separadas, configuráveis e zero desativa uso externo; falha do limitador de execução manual fecha em 503 | `admin-sources.test.mjs`, testes de providers |

## Lacunas e riscos residuais

- A API ainda não aplica limite global por requisição. A proposta ADR 0042 mantém a decisão pendente até definir limites e proxies confiáveis; o cooldown Redis de 60 s para disparos manuais continua ativo. CORS não substitui rate limiting, e uma exposição pública requer limite no ingress antes da decisão final.
- Parsers PDF/OCR executam no processo do worker; há limites de bytes, timeout, páginas e orçamento, mas isolamento de processo/memória não está demonstrado por este passo.
- HSTS só deve ser configurado no terminador TLS após escolha do hosting; habilitá-lo na API local HTTP seria incorreto.
- Regras robots, termos/licença e retenção continuam sendo revisadas por fonte; controles técnicos não autorizam coleta.
- Antes de produção, revisar proxy trust, TLS, segredo/rotação, Redis/Postgres privados, egress, limites do runtime, backup e logs com a infraestrutura real.

## Verificações do passo

- Os testes unitários cobrem literal privada, DNS misto, DNS rebinding no redirect, host cruzado, robots, retries, MIME, bytes e autenticação.
- O E2E da API valida cabeçalhos e CORS em `/health`, rejeição de origem não configurada, respostas genéricas e rotas administrativas sem autenticação.
- Rodar novamente `pnpm test`, `pnpm test:e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm format:check` depois de fechar a política global de rate limit.
