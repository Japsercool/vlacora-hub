$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root

function Write-Step([string]$Text) { Write-Host $Text -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "[WAARSCHUWING] $Text" -ForegroundColor Yellow }
function Require-Docker { if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is niet gevonden." }; docker compose version *> $null; if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 ontbreekt." } }
function Read-EnvFile([string]$Path) { $h=@{}; if(Test-Path $Path){ Get-Content $Path | ForEach-Object { if($_ -match '^\s*([^#][^=]*)=(.*)$'){ $h[$matches[1].Trim()]=$matches[2].Trim() } } }; return $h }
function New-RandomHex([int]$Bytes) { $buffer=New-Object byte[] $Bytes; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer); return (-join ($buffer | ForEach-Object { $_.ToString('x2') })) }

$old=(Get-Content 'secrets\postgres_password.txt' -Raw).Trim(); $new=New-RandomHex 32
Write-Host 'PostgreSQL-wachtwoord veilig roteren...' -ForegroundColor Cyan
docker compose exec -T postgres psql -U pulse_app -d pulse -v ON_ERROR_STOP=1 -c "alter role pulse_app with password '$new';"
if($LASTEXITCODE -ne 0){throw 'ALTER ROLE mislukt; secretbestand is niet gewijzigd.'}
Set-Content -NoNewline -Encoding ASCII 'secrets\postgres_password.txt' $new
docker compose up -d --force-recreate gateway
Write-Host 'PostgreSQL-wachtwoord geroteerd. Het nieuwe wachtwoord blijft alleen in secrets\postgres_password.txt.' -ForegroundColor Green
