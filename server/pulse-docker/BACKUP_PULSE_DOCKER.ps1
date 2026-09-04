param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Args)
& (Join-Path $PSScriptRoot 'scripts\BACKUP_PULSE_DOCKER.ps1') @Args
exit $LASTEXITCODE
