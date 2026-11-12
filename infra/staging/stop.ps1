$ErrorActionPreference = 'Stop'
$stagingDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $stagingDir '.env'
$composeFile = Join-Path $stagingDir 'compose.yml'
if (-not (Test-Path -LiteralPath $envFile)) {
  throw 'The local staging .env file is required to select the Compose project.'
}
$wslEnvFile = (& wsl.exe -d Ubuntu -- wslpath -a $envFile).Trim()
$wslComposeFile = (& wsl.exe -d Ubuntu -- wslpath -a $composeFile).Trim()
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve staging paths inside WSL.' }
wsl.exe -d Ubuntu -- docker compose --env-file $wslEnvFile -f $wslComposeFile down
if ($LASTEXITCODE -ne 0) { throw 'Local staging failed to stop.' }
