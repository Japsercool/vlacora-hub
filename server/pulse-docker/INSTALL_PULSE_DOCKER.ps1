param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Args)
& (Join-Path $PSScriptRoot 'scripts\INSTALL_PULSE_DOCKER.ps1') @Args
exit $LASTEXITCODE
