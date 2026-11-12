# Staging local isolado

`compose.yml` executa web, API, worker, PostgreSQL e Redis em uma rede Docker própria. Web/API são publicados apenas em loopback (`127.0.0.1:8080` e `127.0.0.1:3100`); DB/Redis não têm portas no host. Isso é staging **local**, não homologação externa. O provedor, domínio público, serviços gerenciados, vault e storage oficial permanecem sem decisão conforme ADR 0043/0008.

## Iniciar

1. Gere uma senha hexadecimal aleatória de 64 caracteres, por exemplo com `[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`, e grave-a como `POSTGRES_PASSWORD` em `infra/staging/.env`. Esse arquivo é ignorado pelo Git.
2. Execute no PowerShell a partir deste diretório:

```powershell
./start.ps1
```

3. Aplique migrations manualmente somente depois que PostgreSQL estiver saudável:

```powershell
$envFile = Join-Path (Get-Location) '.env'
$composeFile = Join-Path (Get-Location) 'compose.yml'
$wslEnvFile = (& wsl.exe -d Ubuntu -- wslpath -a $envFile).Trim()
$wslComposeFile = (& wsl.exe -d Ubuntu -- wslpath -a $composeFile).Trim()
wsl.exe -d Ubuntu -- docker compose --env-file $wslEnvFile -f $wslComposeFile run --rm api pnpm --filter @alem-do-sisu/api db:migrate:deploy
```

Migrations não são aplicadas pelo entrypoint/API/worker. O catálogo local usa o build Angular `staging`, chama a API real em loopback e não inclui fixture ou edital. Até seed de processos passa pelos controles de revisão existentes. AI, OCR e quota de busca ficam em zero. Não há storage de documentos conectado; snapshots oficiais permanecem bloqueados.

## Verificar

- Web: `http://127.0.0.1:8080`
- Readiness API: `http://127.0.0.1:3100/ready`
- Playwright real sem mocks: no repositório frontend, `$env:STAGING_BASE_URL='http://127.0.0.1:8080'; corepack pnpm --filter @alem-do-sisu/web exec playwright test --config=playwright.staging.config.ts`
- A suíte de integração usa um banco de teste separado; nunca redirecione `TEST_DATABASE_URL` para `alem_staging`.

## Parar

```powershell
./stop.ps1
```

`stop.ps1` preserva os volumes para o próximo ensaio. Para reiniciar do zero, remova manualmente somente os volumes identificados pelo projeto `alem-do-sisu-staging-local` após confirmar que não contêm dados a preservar. Não use este ambiente para fontes reais, dados oficiais ou produção.

E2E local prova apenas a implantação de containers locais e o caminho browser→API com catálogo vazio. Não comprova domínio/TLS externo, storage, backup gerenciado, fontes ativas, pipeline de descoberta/curadoria nem gate G5.

