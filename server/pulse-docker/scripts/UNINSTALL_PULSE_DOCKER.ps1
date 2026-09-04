param([switch]$RemoveData)
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
if($RemoveData){$a=Read-Host 'DIT VERWIJDERT DOCKER DATABASEVOLUMES. Typ VERWIJDER ALLE PULSE DATA'; if($a -ne 'VERWIJDER ALLE PULSE DATA'){throw 'Geannuleerd'}; docker compose down -v --remove-orphans; Write-Host 'Containers EN volumes verwijderd.' -ForegroundColor Red}else{docker compose down --remove-orphans; Write-Host 'Containers verwijderd; databasevolume, bestanden, secrets en backups behouden.' -ForegroundColor Green}
