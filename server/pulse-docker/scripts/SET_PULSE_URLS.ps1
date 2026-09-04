param([string]$PulseSiteUrl="",[string]$GatewayDomain="")
$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root
function SetEnv($name,$value){$lines=Get-Content .env; $found=$false; $new=@(); foreach($l in $lines){if($l -match "^$([regex]::Escape($name))="){$new += "$name=$value";$found=$true}else{$new+=$l}}; if(-not $found){$new+="$name=$value"}; Set-Content .env $new -Encoding UTF8}
if([string]::IsNullOrWhiteSpace($PulseSiteUrl)){$PulseSiteUrl=Read-Host 'Nieuwe PULSE website-URL'}; $PulseSiteUrl=$PulseSiteUrl.Trim().TrimEnd('/')
if([string]::IsNullOrWhiteSpace($GatewayDomain)){$GatewayDomain=Read-Host 'Nieuwe Gateway-domeinnaam zonder https:// (Enter = behouden)'}
SetEnv 'PULSE_PUBLIC_URL' $PulseSiteUrl; SetEnv 'PULSE_ALLOWED_ORIGIN' $PulseSiteUrl
if(-not [string]::IsNullOrWhiteSpace($GatewayDomain)){SetEnv 'PULSE_GATEWAY_DOMAIN' $GatewayDomain; SetEnv 'PULSE_GATEWAY_PUBLIC_URL' "https://$GatewayDomain"}
$domainLine=Get-Content .env|Where-Object{$_ -like 'PULSE_GATEWAY_DOMAIN=*'}|Select-Object -First 1; $effectiveDomain=if($domainLine){$domainLine.Split('=',2)[1]}else{''}; if($effectiveDomain){docker compose --profile https up -d --force-recreate gateway caddy}else{docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --force-recreate gateway}
Write-Host 'Server-URL-config aangepast. Vergeet de nieuwe Supabase Auth redirect URL niet:' -ForegroundColor Green
Write-Host "$PulseSiteUrl/auth/callback" -ForegroundColor Yellow
