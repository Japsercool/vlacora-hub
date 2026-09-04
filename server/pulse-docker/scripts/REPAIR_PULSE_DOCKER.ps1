$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
function EnvVal($name){$l=Get-Content .env|Where-Object{$_ -like "$name=*"}|Select-Object -First 1; if($l){return $l.Split('=',2)[1]} return ''}
foreach($d in @('secrets','backups','data\files','data\gateway','logs')){New-Item -ItemType Directory -Force -Path $d|Out-Null}
docker compose config *> $null; if($LASTEXITCODE -ne 0){throw 'Compose-config ongeldig'}
$domain=EnvVal 'PULSE_GATEWAY_DOMAIN'; if($domain){docker compose --profile https up -d --build}else{docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build}
Write-Host 'Containers opnieuw opgebouwd zonder data te verwijderen.' -ForegroundColor Green
& "$PSScriptRoot\VERIFY_PULSE_DOCKER.ps1"
