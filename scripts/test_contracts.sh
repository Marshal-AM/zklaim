#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

cd "$ROOT/contracts"
cargo test --workspace --features testutils
echo "=== All contract tests passed ==="
