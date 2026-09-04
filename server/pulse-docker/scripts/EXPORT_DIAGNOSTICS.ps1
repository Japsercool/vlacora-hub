$ErrorActionPreference='Continue'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
$stamp=Get-Date -Format 'yyyyMMdd-HHmmss'; $tmp=Join-Path $Root "logs\diagnostics-$stamp"; New-Item -ItemType Directory -Force -Path $tmp|Out-Null
docker version | Out-File (Join-Path $tmp 'docker-version.txt'); docker compose version | Out-File (Join-Path $tmp 'compose-version.txt'); docker compose ps | Out-File (Join-Path $tmp 'compose-ps.txt'); docker compose logs --tail 500 --no-color gateway postgres caddy 2>&1 | Out-File (Join-Path $tmp 'docker-logs.txt')
if(Test-Path .env){Get-Content .env | ForEach-Object { if($_ -match 'KEY='){($_ -replace '=.*','=***REDACTED***')}else{$_} } | Set-Content (Join-Path $tmp 'env-redacted.txt')}
Copy-Item server-config.json,INSTALLATION_REPORT.txt,VERSION.txt -Destination $tmp -ErrorAction SilentlyContinue
$zip=Join-Path $Root "logs\PULSE_DIAGNOSTICS_$stamp.zip"; Compress-Archive -Path "$tmp\*" -DestinationPath $zip -Force; Remove-Item $tmp -Recurse -Force
Write-Host "Diagnostiek gemaakt ZONDER secretbestanden: $zip" -ForegroundColor Green
