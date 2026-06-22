#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

OUT="$ROOT/contracts/test_fixtures/vks"
mkdir -p "$OUT"

for circuit in policy_validity amount_range doctor_attestation deductible_accumulator; do
  src="$ROOT/circuits/target/bb/$circuit/vk"
  if [[ ! -f "$src" ]]; then
    echo "Missing VK: $src (run bash scripts/test_circuits.sh first)" >&2
    exit 1
  fi
  cp "$src" "$OUT/$circuit.vk"
  echo "  VK: contracts/test_fixtures/vks/$circuit.vk"
done

echo "=== VK export complete ==="
