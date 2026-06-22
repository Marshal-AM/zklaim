#!/usr/bin/env bash
set -euo pipefail

echo "=== ZKlaim WSL Toolchain Installer ==="

echo "[1/7] Bootstrap Ubuntu..."
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
  curl git build-essential pkg-config libssl-dev jq nodejs npm

echo "[2/7] Rust..."
if ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
fi
# shellcheck disable=SC1091
source "$HOME/.cargo/env"
rustc --version
cargo --version

echo "[3/7] wasm32v1-none target..."
rustup target add wasm32v1-none

echo "[4/7] stellar-cli (may take 15-30 min)..."
if ! command -v stellar >/dev/null 2>&1; then
  cargo install --locked stellar-cli --features opt
fi
stellar --version

echo "[5/7] wasm-pack..."
if ! command -v wasm-pack >/dev/null 2>&1; then
  cargo install wasm-pack
fi
wasm-pack --version

echo "[6/7] nargo (noirup)..."
if ! command -v nargo >/dev/null 2>&1; then
  curl -L https://raw.githubusercontent.com/noir-lang/noirup/main/install | bash
  # shellcheck disable=SC1091
  source "$HOME/.bashrc" 2>/dev/null || true
  export PATH="$HOME/.nargo/bin:$PATH"
  noirup -v 1.0.0-beta.3
fi
nargo --version

echo "[7/7] bb (bbup)..."
if ! command -v bb >/dev/null 2>&1; then
  curl -L https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install | bash
  # shellcheck disable=SC1091
  source "$HOME/.bashrc" 2>/dev/null || true
  export PATH="$HOME/.bb:$PATH"
  bbup -v 0.87.0
fi
bb --version

echo ""
echo "=== Verification ==="
rustc --version
cargo --version
rustup target list --installed | grep wasm32v1-none
stellar --version
wasm-pack --version
nargo --version
bb --version

echo ""
echo "=== Installation complete ==="
