param([switch]$SkipBackup)
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
function EnvVal($name){$l=Get-Content .env|Where-Object{$_ -like "$name=*"}|Select-Object -First 1; if($l){return $l.Split('=',2)[1]} return ''}
if(-not $SkipBackup){ & "$PSScriptRoot\BACKUP_PULSE_DOCKER.ps1" }
Write-Host 'PULSE Docker update starten...' -ForegroundColor Cyan
docker compose pull postgres caddy
docker compose build --pull gateway
$domain=EnvVal 'PULSE_GATEWAY_DOMAIN'
if($domain){ docker compose --profile https up -d } else { docker compose -f docker-compose.yml -f docker-compose.local.yml up -d }
Start-Sleep 5
& "$PSScriptRoot\VERIFY_PULSE_DOCKER.ps1"
Write-Host 'Doelmigraties worden bij een actieve eigen PostgreSQL automatisch door de Gateway gecontroleerd.' -ForegroundColor Green
