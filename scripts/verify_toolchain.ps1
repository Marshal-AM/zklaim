# ZKlaim toolchain verification (Windows host, WSL for Phase 3+ tools)
$ErrorActionPreference = "Continue"
$optionalFailed = 0
$requiredFailed = 0

function Test-Command {
    param(
        [string]$Name,
        [string]$Command,
        [string]$Hint,
        [bool]$Required = $false
    )
    Write-Host -NoNewline "Checking $Name... "
    try {
        $output = Invoke-Expression $Command 2>&1
        if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
            throw "exit $LASTEXITCODE"
        }
        Write-Host "OK" -ForegroundColor Green
        if ($output) { Write-Host "  $output" -ForegroundColor DarkGray }
    } catch {
        if ($Required) {
            Write-Host "MISSING (required)" -ForegroundColor Red
            $script:requiredFailed++
        } else {
            Write-Host "MISSING (optional for Phase 3+)" -ForegroundColor Yellow
            $script:optionalFailed++
        }
        Write-Host "  $Hint" -ForegroundColor DarkGray
    }
}

Write-Host "=== ZKlaim Toolchain Verification ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "Required for Phase 1-2 (JS/TS on Windows):" -ForegroundColor Cyan
Test-Command "Node.js" "node --version" "Install Node.js >= 20 from https://nodejs.org/" -Required $true
Test-Command "npm" "npm --version" "Comes with Node.js" -Required $true

Write-Host ""
Write-Host "Required for Phase 3+ (Noir / Soroban in WSL):" -ForegroundColor Cyan

$repoRoot = Split-Path $PSScriptRoot -Parent
$drive = $repoRoot.Substring(0, 1).ToLower()
$rest = $repoRoot.Substring(2) -replace '\\', '/'
$verifyWsl = "/mnt/$drive$rest/scripts/verify_toolchain_wsl.sh"

Write-Host -NoNewline "Checking WSL... "
try {
    $wslOut = wsl bash -lc "echo WSL_OK" 2>&1
    if ($LASTEXITCODE -ne 0) { throw "WSL not available" }
    Write-Host "OK" -ForegroundColor Green
} catch {
    Write-Host "MISSING" -ForegroundColor Red
    Write-Host "  Install WSL Ubuntu, then run: npm run install:toolchain" -ForegroundColor DarkGray
    $optionalFailed += 7
}

if ($optionalFailed -eq 0) {
    Write-Host ""
    wsl bash $verifyWsl
    if ($LASTEXITCODE -ne 0) {
        $optionalFailed = 7
    } else {
        $optionalFailed = 0
    }
}

Write-Host ""
if ($requiredFailed -eq 0) {
    Write-Host "Phase 1-2 toolchain: OK" -ForegroundColor Green
    if ($optionalFailed -gt 0) {
        Write-Host "Phase 3+ tools missing in WSL - run: npm run install:toolchain" -ForegroundColor Yellow
    } else {
        Write-Host "Phase 3+ toolchain (WSL): OK" -ForegroundColor Green
    }
    exit 0
} else {
    Write-Host "$requiredFailed required check(s) failed." -ForegroundColor Red
    exit 1
}
