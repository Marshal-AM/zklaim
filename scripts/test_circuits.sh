#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
cd "$ROOT/circuits"

echo "=== Compiling Noir workspace ==="
nargo compile --workspace

echo "=== Running Noir tests ==="
nargo test --workspace

for circuit in policy_validity amount_range doctor_attestation deductible_accumulator category_nonmembership; do
  echo "=== nargo execute: $circuit ==="
  (cd "./$circuit" && nargo execute)
done

echo "=== bb prove/verify ==="
TARGET="$ROOT/circuits/target"
for circuit in policy_validity amount_range doctor_attestation deductible_accumulator category_nonmembership; do
  OUT="$TARGET/bb/$circuit"
  mkdir -p "$OUT"
  echo "=== bb prove/verify: $circuit ==="
  bb prove -b "$TARGET/$circuit.json" -w "$TARGET/$circuit.gz" --write_vk -o "$OUT" --oracle_hash keccak
  bb verify -k "$OUT/vk" -p "$OUT/proof" -i "$OUT/public_inputs" --oracle_hash keccak
  echo "  OK: $circuit"
done

echo "=== All circuit tests passed ==="
