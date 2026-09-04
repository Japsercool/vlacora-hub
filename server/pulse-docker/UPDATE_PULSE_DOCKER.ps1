$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "PULSE Docker update" -ForegroundColor Cyan
docker compose build --pull gateway
if ($LASTEXITCODE -ne 0) { throw "Gateway build mislukt" }
$envText = Get-Content .env -Raw
if ($envText -match '(?m)^PULSE_GATEWAY_DOMAIN=(.+)$' -and -not [string]::IsNullOrWhiteSpace($Matches[1])) {
  docker compose --profile https up -d
} else {
  docker compose up -d
}
if ($LASTEXITCODE -ne 0) { throw "PULSE containers konden niet worden bijgewerkt" }
Write-Host "Update voltooid. De Gateway voert ontbrekende PULSE-doelmigraties automatisch uit bij actief gebruik." -ForegroundColor Green
