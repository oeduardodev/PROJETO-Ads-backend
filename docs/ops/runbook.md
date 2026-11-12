# Runbook operacional — preview local

Este runbook cobre apenas serviços locais conhecidos. Existe um Compose loopback para staging local em `infra/staging/README.md`; não há homologação externa ou produção configuradas (ADRs 0043 e 0044). Não execute comandos contra um ambiente externo sem autorização explícita e identificação inequívoca do ambiente.

## Escopo local conhecido

- API NestJS e worker inicializam separadamente; health/readiness disponíveis na aplicação.
- `infra/compose.dev.yml` contém somente PostgreSQL 17.7 e Redis 7.4.12 locais, com portas loopback configuráveis.
- `infra/staging/compose.yml` executa web, API, worker, PostgreSQL e Redis locais. Migrations são manuais; banco/Redis não expõem portas ao host; snapshot oficial e fontes permanecem desativados. Use os scripts `infra/staging/start.ps1` e `stop.ps1` no Windows/WSL e leia o README antes de executar.
- `pnpm test:e2e:offline` roda suites independentes; não representa um pipeline integrado.
- Sources oficiais ficam `DRAFT`; chamadas de crawler, busca externa e IA estão desativadas/sem credenciais. O orçamento de IA padrão é zero.
- Não há snapshot oficial habilitado, release pública ou conteúdo de catálogo aprovado.

## Verificações

1. Confirmar branch/commit, ambiente e URLs de dependência antes de iniciar qualquer processo.
2. Para desenvolvimento local, seguir `docs/engineering/local-development.md`; usar somente DB de teste dedicado para migrations/testes.
3. Consultar `GET /health` e `GET /ready`; readiness precisa de Postgres e Redis. Não compartilhar URL/segredo em issue, log ou bundle.
4. Executar `pnpm test`, `pnpm test:integration` e `pnpm test:e2e:offline` conforme os serviços locais requeridos; registrar os relatórios. Resultado verde não demonstra cobertura de fonte nem pipeline único.
5. Consultar logs JSON e métricas administrativas conforme docs de qualidade; não expor `/api/v1/internal/metrics` publicamente.

## Falhas e contenção

- API indisponível: validar processo/configuração sem imprimir secrets, health/readiness, conexão local Postgres/Redis e logs correlacionados. Não tentar migrations automáticas.
- Worker/fila falhando: consultar estado da fila e failed set; retentativa manual somente após verificar idempotência e causa. Não ativar fonte como paliativo.
- Fonte 403/429, mudança ou zero candidatos: manter coleta pausada conforme ADRs 0018/0023; revisão humana do site/termos antes de reativar. Não contornar robots, bloqueio ou autenticação.
- Documento/retificação ambíguos: preservar versão/hash e visibilidade conservadora; encaminhar ao curador. Nunca corrigir prazo ou descartar apenas por palavra/URL.
- Banco ou migration: interromper escrita se houver risco, preservar logs e seguir `docs/ops/backup-restore.md`, `migrations.md` e `rollback.md`. Não restaurar sem avaliar perda de dados e obter aprovação para o ambiente.
- Incidente de segredo/acesso: revogar/rotacionar no cofre, registrar incidente sem incluir o valor comprometido e revisar permissões. O fluxo de rotação em provider ainda precisa ser definido.

## Mudanças e lançamento

Release permanece retida conforme `docs/releases/v1.0-mvp.md`. Não publicar conteúdo nem executar deploy/tag. Depois de ambiente provisionado, anexar aqui contatos operacionais, painéis, SLOs, limites, rota de escalonamento, processo de start/stop e rollback ensaiado; sem estes dados, este runbook não é runbook de produção.

