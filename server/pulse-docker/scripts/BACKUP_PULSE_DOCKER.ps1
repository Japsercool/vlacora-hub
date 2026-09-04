param([int]$RetentionDays=0,[switch]$ExcludeSecrets)
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
if($RetentionDays -le 0){ $line=Get-Content .env|?{$_ -like 'PULSE_BACKUP_RETENTION_DAYS=*'}|Select-Object -First 1; $RetentionDays=if($line){[int]$line.Split('=',2)[1]}else{30} }
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; $dest=Join-Path $Root "backups\pulse-$stamp"; New-Item -ItemType Directory -Force -Path $dest | Out-Null
$db='pulse'; $user='pulse_app'
Write-Host "Backup naar $dest" -ForegroundColor Cyan
$cid=(docker compose ps -q postgres).Trim(); if(-not $cid){throw 'Postgres container ontbreekt'}
docker compose exec -T postgres sh -lc "pg_dump -U $user -d $db -Fc -f /tmp/pulse-backup.dump"; if($LASTEXITCODE -ne 0){throw 'pg_dump mislukt'}
docker cp "${cid}:/tmp/pulse-backup.dump" (Join-Path $dest 'database.dump') | Out-Null
docker compose exec -T postgres rm -f /tmp/pulse-backup.dump | Out-Null
if(Test-Path 'data\files'){ tar -czf (Join-Path $dest 'files.tar.gz') -C 'data\files' . }
if(Test-Path 'data\gateway'){ tar -czf (Join-Path $dest 'gateway-state.tar.gz') -C 'data\gateway' . }
Copy-Item .env,server-config.json,VERSION.txt -Destination $dest -ErrorAction SilentlyContinue
if(-not $ExcludeSecrets){ New-Item -ItemType Directory -Force -Path (Join-Path $dest 'recovery-secrets') | Out-Null; Copy-Item secrets\*.txt -Destination (Join-Path $dest 'recovery-secrets'); Set-Content (Join-Path $dest 'SENSITIVE_BACKUP.txt') 'Deze backup bevat PULSE recovery-secrets. Bewaar de backup privé en versleuteld.' }
$meta=[ordered]@{version='0.31.0';createdAt=(Get-Date).ToString('o');database=$db;user=$user;includesSecrets=(-not $ExcludeSecrets)}; $meta|ConvertTo-Json|Set-Content (Join-Path $dest 'metadata.json') -Encoding UTF8
Get-ChildItem $dest -File -Recurse | Get-FileHash -Algorithm SHA256 | ForEach-Object {"$($_.Hash.ToLower())  $($_.Path.Substring($dest.Length+1).Replace('\\','/'))"} | Set-Content (Join-Path $dest 'SHA256SUMS.txt')
Get-ChildItem backups -Directory | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays)} | Remove-Item -Recurse -Force
Write-Host 'Backup voltooid.' -ForegroundColor Green
