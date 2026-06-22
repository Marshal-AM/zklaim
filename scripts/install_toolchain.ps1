# ZKlaim Phase 3+ toolchain installer (Windows, user scope - no admin required)
$ErrorActionPreference = "Stop"

function Add-UserPath {
    param([string]$Dir)
    $current = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($current -split ';' -contains $Dir) { return }
    $newPath = if ($current) { "$current;$Dir" } else { $Dir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$env:Path;$Dir"
    Write-Host "Added to user PATH: $Dir" -ForegroundColor Green
}

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

Write-Host "=== ZKlaim Toolchain Installer ===" -ForegroundColor Cyan
Write-Host ""

# 1. Rust (rustup)
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Rust (rustup)..." -ForegroundColor Yellow
    $rustup = Join-Path $env:TEMP "rustup-init.exe"
    Invoke-WebRequest -Uri "https://win.rustup.rs/x86_64" -OutFile $rustup
    & $rustup -y --default-toolchain stable
    $cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
    Add-UserPath $cargoBin
    $env:Path = "$cargoBin;$env:Path"
} else {
    Write-Host "Rust already installed: $(cargo --version)" -ForegroundColor Green
}

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
if (Test-Path $cargoBin) {
    $env:Path = "$cargoBin;$env:Path"
}

# 2. wasm32v1-none target
Write-Host "Adding wasm32v1-none target..." -ForegroundColor Yellow
& rustup target add wasm32v1-none

# 3. Nargo (Windows MSVC binary)
$nargoHome = Join-Path $env:USERPROFILE ".nargo"
$nargoBin = Join-Path $nargoHome "bin"
$nargoUri = "https://github.com/noir-lang/noir/releases/download/nightly/nargo-x86_64-pc-windows-msvc.zip"

if (-not (Get-Command nargo -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Nargo..." -ForegroundColor Yellow
    Ensure-Dir $nargoBin
    $zip = Join-Path $env:TEMP "nargo.zip"
    Invoke-WebRequest -Uri $nargoUri -OutFile $zip
    Expand-Archive -Force -Path $zip -DestinationPath $nargoBin
    $noirLangSrc = Join-Path $nargoBin "noir-lang"
    $noirLangDst = Join-Path $env:APPDATA "noir-lang"
    if (Test-Path $noirLangSrc) {
        if (Test-Path $noirLangDst) { Remove-Item -Recurse -Force $noirLangDst }
        Move-Item -Force -Path $noirLangSrc -Destination $noirLangDst
    }
    Add-UserPath $nargoBin
} else {
    Write-Host "Nargo already installed: $(nargo --version)" -ForegroundColor Green
}

# 4. Barretenberg CLI (bb) - download Windows binary if available
$bbHome = Join-Path $env:USERPROFILE ".bb"
$bbBin = Join-Path $bbHome "bin"
Ensure-Dir $bbBin

if (-not (Get-Command bb -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Barretenberg (bb)..." -ForegroundColor Yellow
    # Aztec bb releases - try latest github asset for windows
    $bbUri = "https://github.com/AztecProtocol/aztec-packages/releases/download/v0.63.0/bb-x86_64-windows-gnu.zip"
    try {
        $zip = Join-Path $env:TEMP "bb.zip"
        Invoke-WebRequest -Uri $bbUri -OutFile $zip -ErrorAction Stop
        Expand-Archive -Force -Path $zip -DestinationPath $bbBin
        Add-UserPath $bbBin
        Write-Host "bb installed from release zip" -ForegroundColor Green
    } catch {
        Write-Host "bb zip not found at expected URL - install via WSL: bbup -v 0.63.0" -ForegroundColor Yellow
        Write-Host "  $_" -ForegroundColor DarkGray
    }
} else {
    Write-Host "bb already installed: $(bb --version)" -ForegroundColor Green
}

# 5. stellar-cli + wasm-pack via cargo
Write-Host "Installing stellar-cli (this may take several minutes)..." -ForegroundColor Yellow
& cargo install --locked stellar-cli --features opt 2>&1 | Write-Host

Write-Host "Installing wasm-pack..." -ForegroundColor Yellow
& cargo install wasm-pack 2>&1 | Write-Host

Write-Host ""
Write-Host "=== Installation complete ===" -ForegroundColor Cyan
Write-Host "Restart your terminal, then run: npm run verify:toolchain" -ForegroundColor Green
