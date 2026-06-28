#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
cd "$ROOT"

echo "=== Generating circuit test vectors ==="
npm run generate:circuit-vectors -w scripts

echo "=== Running circuit compile, test, and bb prove/verify ==="
bash "$ROOT/scripts/test_circuits.sh"

echo "=== Copying ACIR artifacts to client/wasm/ ==="
cd "$ROOT/circuits"
mkdir -p "$ROOT/client/wasm"
for circuit in policy_validity amount_range doctor_attestation deductible_accumulator category_nonmembership; do
  cp "./target/${circuit}.json" "$ROOT/client/wasm/${circuit}.json"
  echo "  ACIR: client/wasm/${circuit}.json"
done

echo "=== Phase 3 build complete ==="
