$ErrorActionPreference='Continue'
$Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
$fail=0
function Pass($m){Write-Host "[PASS] $m" -ForegroundColor Green}
function Fail($m){Write-Host "[FAIL] $m" -ForegroundColor Red; $script:fail++}
function Warn($m){Write-Host "[WARN] $m" -ForegroundColor Yellow}
if(Get-Command docker -ErrorAction SilentlyContinue){Pass 'Docker gevonden'}else{Fail 'Docker ontbreekt'}
docker compose config *> $null; if($LASTEXITCODE -eq 0){Pass 'docker compose config geldig'}else{Fail 'docker compose config ongeldig'}
foreach($f in @('.env','secrets\postgres_password.txt','secrets\gateway_setup_token.txt','secrets\gateway_master_key.txt')){ if(Test-Path $f){Pass "$f aanwezig"}else{Fail "$f ontbreekt"} }
$pid=(docker compose ps -q postgres 2>$null).Trim(); if($pid){$ports=(docker inspect --format='{{json .NetworkSettings.Ports}}' $pid); if($ports -match '5432/tcp":null'){Pass 'PostgreSQL 5432 niet gepubliceerd'}else{Fail "PostgreSQL lijkt extern gepubliceerd: $ports"}}else{Fail 'Postgres container niet actief'}
$gid=(docker compose ps -q gateway 2>$null).Trim(); if($gid){$h=(docker inspect --format='{{.State.Health.Status}}' $gid); if($h -eq 'healthy'){Pass 'Gateway healthy'}else{Warn "Gateway health=$h"}}else{Fail 'Gateway container niet actief'}
$latest=Get-ChildItem backups -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if($latest){$age=((Get-Date)-$latest.LastWriteTime).TotalDays; if($age -le 2){Pass "Recente backup: $($latest.Name)"}else{Warn "Laatste backup is $([math]::Round($age,1)) dagen oud"}}else{Warn 'Nog geen backup gevonden'}
if($fail -gt 0){Write-Host "Controle afgerond met $fail fout(en)." -ForegroundColor Red; exit 1}else{Write-Host 'Controle afgerond zonder blokkerende fouten.' -ForegroundColor Green}
