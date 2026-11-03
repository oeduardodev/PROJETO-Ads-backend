# Além do SiSU — desenvolvimento local

Catálogo em construção para processos de ingresso em graduação pública gratuita fora do fluxo regular do SiSU. Este repositório contém a API NestJS, o worker e a documentação canônica; o Angular está no repositório irmão `../frontend` (ADR 0000). Nenhum edital é publicado automaticamente.

## Pré-requisitos

- Dois checkouts locais irmãos: `backend/` e `frontend/`. Os remotos GitHub ainda estão vazios porque não houve push; para reproduzir o estado atual, use cópias/clones dos repositórios **locais** até que a publicação seja autorizada.
- Node.js 24.15.0, Corepack e pnpm 12.16.1 (`corepack pnpm --version`).
- Docker Engine com Compose v2. No Windows, pode ser o Engine no Ubuntu 24.04 do WSL 2; nesse caso, execute os comandos `docker compose` no terminal Ubuntu dentro do diretório `backend` montado em `/mnt/c/`. Os comandos Node abaixo rodam no PowerShell.
- Portas livres: PostgreSQL `5433`, Redis `6380`, API `3000` e web `4200`, todas em `127.0.0.1`.

## Preparação (uma vez)

No PowerShell, na raiz de `backend`:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
corepack pnpm install --frozen-lockfile
corepack pnpm build
```

Edite `.env` localmente. Crie uma senha exclusiva em `POSTGRES_PASSWORD` e use a mesma senha, codificada para URL se necessário, em `DATABASE_URL=postgresql://alem_do_sisu:<senha>@127.0.0.1:5433/alem_do_sisu`. Mantenha `REDIS_URL=redis://127.0.0.1:6380` e `CORS_ORIGINS=http://127.0.0.1:4200`. O arquivo `.env` é ignorado pelo Git; não copie chaves privadas para `frontend/`. Busca e IA ainda não precisam de chaves, conforme ADR 0004.

No PowerShell, em `../frontend`:

```powershell
corepack pnpm install --frozen-lockfile
```

## Iniciar (terminais separados)

1. **PostgreSQL e Redis:** no terminal que tem Docker Compose, dentro de `backend/`:

   ```text
   docker compose --env-file .env -f infra/compose.dev.yml up -d --wait
   docker compose --env-file .env -f infra/compose.dev.yml ps
   ```

2. **API:** no PowerShell, em `backend/`:

   ```powershell
   node --env-file=.env apps/api/dist/main.js
   ```

3. **Worker:** em outro PowerShell, em `backend/`:

   ```powershell
   node --env-file=.env apps/api/dist/worker.js
   ```

   Neste estágio, ele valida a configuração, inicializa e encerra, porque as filas ainda não foram implementadas.

4. **Web:** em outro PowerShell, em `frontend/`:

   ```powershell
   corepack pnpm --filter @alem-do-sisu/web exec ng serve --host 127.0.0.1 --port 4200
   ```

Acesse `http://127.0.0.1:4200/` e verifique `http://127.0.0.1:3000/health` (HTTP 200, `{"status":"ok"}`). O shell web funciona mesmo sem a API e deixa claro que o catálogo está em preparação. Não há migration nem seed automática neste passo.

## Testar e encerrar

Em **cada** repositório, rode `corepack pnpm lint`, `corepack pnpm typecheck`, `corepack pnpm test`, `corepack pnpm build` e, se desejar conferir a inicialização, `corepack pnpm test:e2e`. `corepack pnpm format:check` confere a formatação.

Para parar os serviços, execute `docker compose --env-file .env -f infra/compose.dev.yml stop` no diretório `backend/`. `up -d --wait` os reinicia mantendo os volumes. Para um **reset destrutivo somente dos dados locais**, pare os processos Node e use `docker compose --env-file .env -f infra/compose.dev.yml down --volumes`; isso apaga os bancos locais e não é necessário para o setup normal. Nunca execute esse comando contra produção.

Detalhes de portas, configuração e diagnóstico estão em [docs/engineering/local-development.md](docs/engineering/local-development.md). O estado da implementação e as pendências estão em [docs/implementation/PROGRESS.md](docs/implementation/PROGRESS.md).
