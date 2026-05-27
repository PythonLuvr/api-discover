# api-discover installer (Windows / PowerShell).
# Idempotent. Re-run after `git pull` to refresh.

$ErrorActionPreference = 'Stop'

function Say($msg) { Write-Host "[install] $msg" -ForegroundColor Blue }
function OK($msg)  { Write-Host "[ok] $msg"      -ForegroundColor Green }
function Err($msg) { Write-Host "[error] $msg"   -ForegroundColor Red }

$repoRoot = (Get-Item $PSScriptRoot).FullName
$binDir = Join-Path $env:USERPROFILE ".local\bin"
if (-not (Test-Path $binDir)) { New-Item -ItemType Directory -Path $binDir -Force | Out-Null }

# --- Prereqs ---

Say "Checking prerequisites..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Err "node not found. Install Node 18+ from https://nodejs.org/"; exit 1
}
$nodeMajor = [int](node -e "console.log(process.versions.node.split('.')[0])")
if ($nodeMajor -lt 18) { Err "Node 18+ required, found $(node --version)"; exit 1 }
OK "Node $(node --version)"

$py = Get-Command python -ErrorAction SilentlyContinue
if (-not $py) { $py = Get-Command python3 -ErrorAction SilentlyContinue }
if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { Err "Python not found. Install Python 3.10+ from https://www.python.org/"; exit 1 }
OK "Python at $($py.Source)"

if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Say "uv not found, installing via the official installer..."
  irm https://astral.sh/uv/install.ps1 | iex
  $env:PATH = "$env:USERPROFILE\.local\bin;$env:PATH"
}
OK "uv present"

# --- browser-harness ---

if (-not (Get-Command browser-harness -ErrorAction SilentlyContinue)) {
  Say "Installing browser-harness via uv..."
  uv tool install browser-harness
} else {
  OK "browser-harness already on PATH at $((Get-Command browser-harness).Source)"
}

# --- api-discover shim ---

$shimPath = Join-Path $binDir "api-discover.cmd"
$sourceBin = Join-Path $repoRoot "bin\api-discover.mjs"

$shimContent = "@echo off`r`nnode `"$sourceBin`" %*`r`n"
Set-Content -Path $shimPath -Value $shimContent -Encoding ASCII
OK "Wrote shim $shimPath"

# --- PATH check ---

$onPath = ($env:PATH -split ';') -contains $binDir
if (-not $onPath) {
  Say "Note: $binDir is not on PATH. Add it via System Settings or run:"
  Write-Host "    [Environment]::SetEnvironmentVariable('PATH', `"`$env:PATH;$binDir`", 'User')"
}

Write-Host ""
OK "Installed. Run 'api-discover doctor' to verify."
