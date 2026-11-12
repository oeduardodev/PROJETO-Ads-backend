$ErrorActionPreference = 'Stop'
$stagingDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $stagingDir '.env'
$composeFile = Join-Path $stagingDir 'compose.yml'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'Copy .env.example to .env and set a random local-only POSTGRES_PASSWORD.'
}
$wslEnvFile = (& wsl.exe -d Ubuntu -- wslpath -a $envFile).Trim()
$wslComposeFile = (& wsl.exe -d Ubuntu -- wslpath -a $composeFile).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve staging paths inside WSL.' }
wsl.exe -d Ubuntu -- docker compose --env-file $wslEnvFile -f $wslComposeFile up --build --detach
if ($LASTEXITCODE -ne 0) { throw 'Local staging failed to start.' }
Write-Output 'Web: http://127.0.0.1:8080'
Write-Output 'API readiness: http://127.0.0.1:3100/ready'
Write-Output 'PostgreSQL and Redis are private to the Compose network.'
