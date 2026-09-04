$ErrorActionPreference='Stop'; $Root=Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path); Set-Location $Root

function Write-Step([string]$Text) { Write-Host $Text -ForegroundColor Cyan }
function Write-Ok([string]$Text) { Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Warn2([string]$Text) { Write-Host "[WAARSCHUWING] $Text" -ForegroundColor Yellow }
function Require-Docker { if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw "Docker is niet gevonden." }; docker compose version *> $null; if ($LASTEXITCODE -ne 0) { throw "Docker Compose v2 ontbreekt." } }
function Read-EnvFile([string]$Path) { $h=@{}; if(Test-Path $Path){ Get-Content $Path | ForEach-Object { if($_ -match '^\s*([^#][^=]*)=(.*)$'){ $h[$matches[1].Trim()]=$matches[2].Trim() } } }; return $h }
function New-RandomHex([int]$Bytes) { $buffer=New-Object byte[] $Bytes; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buffer); return (-join ($buffer | ForEach-Object { $_.ToString('x2') })) }

$new=New-RandomHex 32; Set-Content -NoNewline -Encoding ASCII 'secrets\gateway_setup_token.txt' $new
docker compose up -d --force-recreate gateway
Write-Host 'Nieuwe eenmalige setup-code:' -ForegroundColor Green; Write-Host $new -ForegroundColor Yellow
Write-Host 'Werk PULSE_SERVER_KOPPELING.txt bij of koppel opnieuw indien nodig.'
