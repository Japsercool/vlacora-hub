$ErrorActionPreference='Continue'
$Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
Write-Host 'PULSE Docker status' -ForegroundColor Cyan
docker compose ps
Write-Host ''
$id=(docker compose ps -q postgres 2>$null).Trim(); if($id){Write-Host ('PostgreSQL health: '+(docker inspect --format='{{.State.Health.Status}}' $id))}
$gid=(docker compose ps -q gateway 2>$null).Trim(); if($gid){Write-Host ('Gateway health: '+(docker inspect --format='{{.State.Health.Status}}' $gid))}
try { $envs=Get-Content .env; $url=($envs|?{$_ -like 'PULSE_GATEWAY_PUBLIC_URL=*'}).Split('=',2)[1]; Write-Host "Gateway URL: $url" } catch {}
Write-Host 'PostgreSQL 5432 hoort NIET in de gepubliceerde ports te staan.' -ForegroundColor DarkGray
