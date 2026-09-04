$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path (Get-Location) "backups\$stamp"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Write-Host "Databasebackup maken..." -ForegroundColor Yellow
docker compose exec -T postgres sh -c "pg_dump -U pulse_app -d pulse -Fc -f /tmp/pulse.dump"
if ($LASTEXITCODE -ne 0) { throw "pg_dump mislukt" }
$containerId = (docker compose ps -q postgres).Trim()
if ([string]::IsNullOrWhiteSpace($containerId)) { throw "PostgreSQL-container niet gevonden" }
docker cp "${containerId}:/tmp/pulse.dump" "$dir\pulse.dump"
docker compose exec -T postgres rm -f /tmp/pulse.dump | Out-Null

Write-Host "Configuratiesnapshot opslaan..." -ForegroundColor Yellow
docker compose config | Set-Content "$dir\docker-compose.resolved.yml"
Copy-Item .env "$dir\.env" -Force
Write-Host "Backup klaar: $dir" -ForegroundColor Green
Write-Warning "Maak voor productie daarnaast een snapshot/back-up van het Docker volume met PULSE-bestanden."
