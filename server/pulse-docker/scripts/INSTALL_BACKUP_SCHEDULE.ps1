param([string]$Time='03:00')
$Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); $script=Join-Path $Root 'scripts\BACKUP_PULSE_DOCKER.ps1'
$taskName='PULSE Daily Backup'; $cmd="powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$script`""
schtasks /Create /TN "$taskName" /TR "$cmd" /SC DAILY /ST $Time /RU SYSTEM /RL HIGHEST /F
if($LASTEXITCODE -ne 0){throw 'Kon geplande taak niet maken. Start PowerShell als administrator.'}
Write-Host "Dagelijkse backup gepland om $Time" -ForegroundColor Green
