param([Parameter(Mandatory=$true)][string]$BackupPath,[switch]$KeepCurrentSecrets)
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
$BackupPath=(Resolve-Path $BackupPath).Path
if(-not (Test-Path (Join-Path $BackupPath 'database.dump'))){throw 'database.dump ontbreekt in backup'}
$answer=Read-Host 'RESTORE overschrijft de huidige PULSE-doeldatabase en bestanden. Typ HERSTEL om door te gaan'; if($answer -ne 'HERSTEL'){throw 'Herstel geannuleerd'}
Write-Host 'Huidige omgeving stoppen (PostgreSQL blijft beschikbaar)...' -ForegroundColor Yellow
docker compose stop gateway caddy 2>$null | Out-Null
if((Test-Path (Join-Path $BackupPath 'recovery-secrets')) -and -not $KeepCurrentSecrets){ Copy-Item (Join-Path $BackupPath 'recovery-secrets\*.txt') -Destination 'secrets' -Force }
$cid=(docker compose ps -q postgres).Trim(); if(-not $cid){docker compose up -d postgres; Start-Sleep 5; $cid=(docker compose ps -q postgres).Trim()}
docker cp (Join-Path $BackupPath 'database.dump') "${cid}:/tmp/pulse-restore.dump" | Out-Null
docker compose exec -T postgres psql -U pulse_app -d postgres -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='pulse' and pid<>pg_backend_pid();" | Out-Null
docker compose exec -T postgres dropdb -U pulse_app --if-exists pulse
docker compose exec -T postgres createdb -U pulse_app pulse
docker compose exec -T postgres pg_restore -U pulse_app -d pulse --no-owner --no-privileges /tmp/pulse-restore.dump
if($LASTEXITCODE -ne 0){throw 'pg_restore mislukt'}
docker compose exec -T postgres rm -f /tmp/pulse-restore.dump | Out-Null
if(Test-Path (Join-Path $BackupPath 'files.tar.gz')){ Remove-Item 'data\files\*' -Recurse -Force -ErrorAction SilentlyContinue; tar -xzf (Join-Path $BackupPath 'files.tar.gz') -C 'data\files' }
if(Test-Path (Join-Path $BackupPath 'gateway-state.tar.gz')){ Remove-Item 'data\gateway\*' -Recurse -Force -ErrorAction SilentlyContinue; tar -xzf (Join-Path $BackupPath 'gateway-state.tar.gz') -C 'data\gateway' }
function EnvVal($name){$l=Get-Content .env|Where-Object{$_ -like "$name=*"}|Select-Object -First 1; if($l){return $l.Split('=',2)[1]} return ''}
$domain=EnvVal 'PULSE_GATEWAY_DOMAIN'; if($domain){docker compose --profile https up -d --build}else{docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build}
Write-Host 'Herstel voltooid. Voer VERIFY_PULSE_DOCKER.ps1 uit.' -ForegroundColor Green
