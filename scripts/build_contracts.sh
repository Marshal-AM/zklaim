#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release
echo "=== Contract WASM build complete ==="
