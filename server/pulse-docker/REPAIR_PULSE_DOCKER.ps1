$ErrorActionPreference = "Continue"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
Write-Host "PULSE Docker controle" -ForegroundColor Cyan
$required = @('.env','docker-compose.yml','secrets/postgres_password.txt','secrets/gateway_setup_token.txt','secrets/gateway_master_key.txt')
foreach ($file in $required) {
  if (Test-Path $file) { Write-Host "OK  $file" -ForegroundColor Green } else { Write-Host "MIS $file" -ForegroundColor Red }
}
docker compose ps
docker compose exec -T postgres pg_isready -U pulse_app -d pulse
try { Invoke-RestMethod http://127.0.0.1:8787/health | ConvertTo-Json -Depth 8 } catch { Write-Warning $_ }
Write-Host "Herstart indien nodig met: docker compose restart" -ForegroundColor Yellow
