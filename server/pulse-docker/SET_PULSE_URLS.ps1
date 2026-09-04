param([Parameter(ValueFromRemainingArguments=$true)][object[]]$Args)
& (Join-Path $PSScriptRoot 'scripts\SET_PULSE_URLS.ps1') @Args
exit $LASTEXITCODE
