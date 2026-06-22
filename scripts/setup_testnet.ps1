# Configure Stellar testnet for ZKlaim deployment
$ErrorActionPreference = "Stop"

Write-Host "=== ZKlaim Testnet Setup ===" -ForegroundColor Cyan

if (-not (Get-Command stellar -ErrorAction SilentlyContinue)) {
    Write-Host "stellar-cli not found. Install with:" -ForegroundColor Yellow
    Write-Host "  cargo install --locked stellar-cli --features opt"
    exit 1
}

Write-Host "Adding testnet network..."
stellar network add testnet `
    --rpc-url https://soroban-testnet.stellar.org `
    --network-passphrase "Test SDF Network ; September 2015" 2>$null

Write-Host ""
Write-Host "Fund your deployer account via Friendbot:" -ForegroundColor Green
Write-Host "  https://laboratory.stellar.org/#account-creator?network=testnet"
Write-Host ""
Write-Host "Or generate a keypair:" -ForegroundColor Green
Write-Host "  stellar keys generate --global default"
Write-Host "  stellar keys fund default --network testnet"
Write-Host ""
Write-Host "Copy .env.example to .env and fill contract IDs after Phase 4 deploy."
