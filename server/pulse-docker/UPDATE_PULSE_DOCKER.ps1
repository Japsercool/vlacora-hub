param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Args)
& (Join-Path $PSScriptRoot 'scripts\UPDATE_PULSE_DOCKER.ps1') @Args
exit $LASTEXITCODE
