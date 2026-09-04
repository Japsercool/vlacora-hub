param(
  [string]$PulseSiteUrl = "",
  [string]$SupabaseAuthUrl = "",
  [string]$SupabasePublishableKey = "",
  [ValidateSet("production","local")][string]$Mode = "production",
  [string]$GatewayDomain = "",
  [switch]$NoStart,
  [switch]$SkipNetworkChecks
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Write-Step([string]$Text) { Write-Host $Text -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "[WAARSCHUWING] $Text" -ForegroundColor Yellow }
function Require-Docker { if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is niet gevonden." }; docker compose version *> $null; if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 ontbreekt." } }
function Read-EnvFile([string]$Path) { $h=@{}; if(Test-Path $Path){ Get-Content $Path | ForEach-Object { if($_ -match '^\s*([^#][^=]*)=(.*)$'){ $h[$matches[1].Trim()]=$matches[2].Trim() } } }; return $h }
function New-RandomHex([int]$Bytes) { $buffer=New-Object byte[] $Bytes; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer); return (-join ($buffer | ForEach-Object { $_.ToString('x2') })) }

function Need([string]$Value,[string]$Prompt){ if(-not [string]::IsNullOrWhiteSpace($Value)){return $Value.Trim()}; do{$v=Read-Host $Prompt}while([string]::IsNullOrWhiteSpace($v)); return $v.Trim() }
function Normalize-Url([string]$u){ return $u.Trim().TrimEnd('/') }

Write-Host ""; Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " PULSE SERVER 0.31 - VOLLEDIGE DOCKER INSTALLATIE" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host "PostgreSQL wordt automatisch aangemaakt. Je hoeft GEEN databasewachtwoord te kiezen." -ForegroundColor Gray
Write-Host ""
Require-Docker
$PulseSiteUrl = Normalize-Url (Need $PulseSiteUrl "Publieke PULSE website-URL (bv. https://pulse.jouwdomein.be)")
$SupabaseAuthUrl = Normalize-Url (Need $SupabaseAuthUrl "Supabase Auth URL (https://PROJECT.supabase.co)")
$SupabasePublishableKey = Need $SupabasePublishableKey "Supabase publishable key"
if($Mode -eq 'production'){ $GatewayDomain = Need $GatewayDomain "Publieke Gateway-domeinnaam ZONDER https:// (bv. api.pulse.jouwdomein.be)" }

foreach($d in @('secrets','backups','data\files','data\gateway','data\postgrest','logs')){ New-Item -ItemType Directory -Force -Path (Join-Path $Root $d) | Out-Null }
$secretFiles = @{
  'postgres_password.txt' = 32
  'gateway_setup_token.txt' = 32
  'gateway_master_key.txt' = 32
  'postgrest_jwt_secret.txt' = 32
}
foreach($kv in $secretFiles.GetEnumerator()){
  $p=Join-Path $Root ('secrets\'+$kv.Key)
  if(-not (Test-Path $p)){ Set-Content -NoNewline -Encoding ASCII $p (New-RandomHex $kv.Value) }
}
try { icacls (Join-Path $Root 'secrets') /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null } catch { Write-Warn2 "Kon ACL op secrets niet automatisch beperken." }

$gatewayPublicUrl = if($Mode -eq 'production'){ "https://$GatewayDomain" } else { "http://127.0.0.1:8787" }
$envText = @"
PULSE_PUBLIC_URL=$PulseSiteUrl
PULSE_ALLOWED_ORIGIN=$PulseSiteUrl
PULSE_GATEWAY_DOMAIN=$GatewayDomain
PULSE_GATEWAY_PUBLIC_URL=$gatewayPublicUrl
PULSE_GATEWAY_BIND=127.0.0.1
PULSE_GATEWAY_PORT=8787
SUPABASE_AUTH_URL=$SupabaseAuthUrl
SUPABASE_PUBLISHABLE_KEY=$SupabasePublishableKey
PULSE_POSTGRES_DB=pulse
PULSE_POSTGRES_USER=pulse_app
PULSE_POSTGRES_IMAGE=postgres:17-alpine
PULSE_CADDY_IMAGE=caddy:2.10-alpine
PULSE_POSTGREST_IMAGE=postgrest/postgrest:v12.2.12
PULSE_SOURCE_STORAGE_BUCKET=vlacora-hub-files
PULSE_BACKUP_RETENTION_DAYS=30
"@
Set-Content -Path (Join-Path $Root '.env') -Value $envText -Encoding UTF8

$pgPass=(Get-Content (Join-Path $Root 'secrets\postgres_password.txt') -Raw).Trim()
$pgJwt=(Get-Content (Join-Path $Root 'secrets\postgrest_jwt_secret.txt') -Raw).Trim()
$postgrestConfig = @"
db-uri = "postgres://pulse_app:$pgPass@postgres:5432/pulse"
db-schemas = "public"
db-anon-role = "anon"
jwt-secret = "$pgJwt"
server-port = 3000
openapi-mode = "disabled"
"@
Set-Content -Path (Join-Path $Root 'data\postgrest\postgrest.conf') -Value $postgrestConfig -Encoding UTF8
try { icacls (Join-Path $Root 'data\postgrest') /inheritance:r /grant:r "${env:USERNAME}:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null } catch {}

$config = [ordered]@{ version='0.32.0'; installedAt=(Get-Date).ToString('o'); mode=$Mode; siteUrl=$PulseSiteUrl; gatewayUrl=$gatewayPublicUrl; gatewayDomain=$GatewayDomain; postgresDatabase='pulse'; postgresUser='pulse_app'; postgresPortPublished=$false; supabaseAuthUrl=$SupabaseAuthUrl }
$config | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $Root 'server-config.json') -Encoding UTF8

Write-Ok "Veilige random PostgreSQL- en Gateway-secrets aangemaakt"
Write-Ok "Mappenstructuur aangemaakt"
Write-Ok "Configuratie geschreven"

if($Mode -eq 'production' -and -not $SkipNetworkChecks){
  try { $resolved = Resolve-DnsName $GatewayDomain -ErrorAction Stop | Where-Object {$_.IPAddress} | Select-Object -First 1; if($resolved){Write-Ok "DNS voor $GatewayDomain resolveert naar $($resolved.IPAddress)"} } catch { Write-Warn2 "DNS voor $GatewayDomain kon nog niet worden bevestigd. Caddy kan pas een certificaat ophalen als DNS + poorten 80/443 kloppen." }
}

Write-Step "Docker Compose configuratie controleren..."
docker compose config *> $null
if($LASTEXITCODE -ne 0){ throw 'docker compose config is ongeldig.' }
Write-Ok "Docker Compose is geldig"

if(-not $NoStart){
  Write-Step "Images ophalen/bouwen en PULSE starten..."
  if($Mode -eq 'production'){
    docker compose --profile https up -d --build
  } else {
    docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
  }
  if($LASTEXITCODE -ne 0){ throw 'Docker Compose kon PULSE niet starten.' }

  Write-Step "PostgreSQL healthcheck afwachten..."
  $healthy=$false
  for($i=0;$i -lt 90;$i++){
    $id=(docker compose ps -q postgres 2>$null).Trim()
    if($id){ $st=(docker inspect --format='{{.State.Health.Status}}' $id 2>$null).Trim(); if($st -eq 'healthy'){ $healthy=$true; break } }
    Start-Sleep -Seconds 2
  }
  if(-not $healthy){ throw 'PostgreSQL werd niet healthy. Bekijk docker compose logs postgres.' }
  Write-Ok "PostgreSQL 17 is healthy"

  Write-Step "Gateway healthcheck..."
  if($Mode -eq 'local'){
    for($i=0;$i -lt 45;$i++){ try { $h=Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health/ready' -TimeoutSec 5; if($h.ready){break} } catch {}; Start-Sleep -Seconds 2 }
    if(-not $h.ready){ throw 'Gateway is lokaal niet ready.' }
    Write-Ok "Gateway is ready"
  } else {
    Write-Ok "Gateway-container gestart; HTTPS-certificaat kan enkele minuten duren"
  }
}

$setup=(Get-Content (Join-Path $Root 'secrets\gateway_setup_token.txt') -Raw).Trim()
$link = @"
PULSE SERVER KOPPELING - PRIVÉ BEWAREN
=====================================
Versie: 0.32.0
Gateway URL: $gatewayPublicUrl
Setup-code: $setup
PULSE site: $PulseSiteUrl
Database: pulse (automatisch beheerde PostgreSQL 17 in Docker)
Databasegebruiker: pulse_app (alleen intern)
Poort 5432 publiek: NEE

In PULSE: Beheer > Database-backend > Beheerde PULSE Docker-server.
Vul alleen Gateway URL + Setup-code in. De PostgreSQL-inloggegevens worden NIET in de browser gezet.
"@
Set-Content -Path (Join-Path $Root 'PULSE_SERVER_KOPPELING.txt') -Value $link -Encoding UTF8
try { icacls (Join-Path $Root 'PULSE_SERVER_KOPPELING.txt') /inheritance:r /grant:r "${env:USERNAME}:F" "Administrators:F" | Out-Null } catch {}

$report = @"
PULSE SERVER INSTALLATIERAPPORT
Versie: 0.32.0
Datum: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Mode: $Mode
PULSE site: $PulseSiteUrl
Gateway: $gatewayPublicUrl
PostgreSQL: Docker intern, database pulse, gebruiker pulse_app, 5432 niet gepubliceerd
Supabase Auth: $SupabaseAuthUrl
Volgende stap: open PULSE > Beheer > Database-backend en koppel de Gateway.
"@
Set-Content -Path (Join-Path $Root 'INSTALLATION_REPORT.txt') -Value $report -Encoding UTF8

Write-Host ""; Write-Host "PULSE SERVER IS VOORBEREID" -ForegroundColor Green
Write-Host "Gateway: $gatewayPublicUrl" -ForegroundColor Yellow
Write-Host "De eenmalige setup-code staat in PULSE_SERVER_KOPPELING.txt" -ForegroundColor Yellow
Write-Host "Lees nu HANDLEIDING\05_PULSE_KOPPELEN.md" -ForegroundColor Cyan
