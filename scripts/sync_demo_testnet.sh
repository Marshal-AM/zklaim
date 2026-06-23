#!/usr/bin/env bash
# Re-seed testnet ASP/fraud leaves and register demo policy bounds ($1–$500).
# Safe to re-run: skips ASP inserts when root matches; fraud duplicates are skipped.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN="$(stellar keys address "$IDENTITY")"

cd "$ROOT"
npm run build:trees

if [[ ! -f .env ]]; then
  echo "Missing .env — run bash scripts/deploy.sh first" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$ROOT/.env"

ASP_ID="${ASP_MEMBER_CONTRACT_ID:?}"
ASP_FRAUD_ID="${ASP_FRAUD_CONTRACT_ID:?}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?}"

echo "=== ZKlaim demo testnet sync (identity: $IDENTITY, insurer: $ADMIN) ==="

echo "=== ASP doctor leaves ==="
EXPECTED_ROOT=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/asp_tree.json', 'utf8'));
process.stdout.write(t.root.replace(/^0x/i, '').toLowerCase());
")
CURRENT_ROOT=$(stellar contract invoke --id "$ASP_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root 2>/dev/null | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//' || true)

if [[ -n "$CURRENT_ROOT" && "$CURRENT_ROOT" == "$EXPECTED_ROOT" ]]; then
  echo "  ASP root already matches asp_tree.json — skipping leaf inserts"
elif [[ -n "$CURRENT_ROOT" && "$CURRENT_ROOT" != "0000000000000000000000000000000000000000000000000000000000000000" ]]; then
  echo "  ERROR: ASP root mismatch (on-chain=0x${CURRENT_ROOT}, expected=0x${EXPECTED_ROOT})" >&2
  echo "  Re-run: npm run redeploy:asp-escrow" >&2
  exit 1
else
  node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/asp_tree.json', 'utf8'));
for (const d of t.doctors) {
  console.log(d.leaf.replace(/^0x/, ''));
}
" | while read -r leaf; do
    stellar contract invoke --id "$ASP_ID" --source-account "$IDENTITY" --network "$NETWORK" \
      -- insert_leaf --admin "$ADMIN" --commitment "$leaf"
  done
fi

echo "=== Fraud blacklist patterns ==="
EXPECTED_FRAUD_ROOT=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/fraud_tree.json', 'utf8'));
process.stdout.write(t.root.replace(/^0x/i, '').toLowerCase());
")
CURRENT_FRAUD_ROOT=$(stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root 2>/dev/null | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//' || true)

if [[ -n "$CURRENT_FRAUD_ROOT" && "$CURRENT_FRAUD_ROOT" == "$EXPECTED_FRAUD_ROOT" ]]; then
  echo "  Fraud root already matches fraud_tree.json — skipping pattern inserts"
elif [[ -n "$CURRENT_FRAUD_ROOT" && "$CURRENT_FRAUD_ROOT" != "$EXPECTED_FRAUD_ROOT" ]]; then
  node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/fraud_tree.json', 'utf8'));
for (const e of t.leaves) {
  console.log(e.billing_pattern_hash.replace(/^0x/, ''));
}
" | while read -r pattern; do
    stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
      -- insert_pattern --admin "$ADMIN" --billing_pattern_hash "$pattern" \
      || echo "  (skip duplicate pattern)"
  done
  CURRENT_FRAUD_ROOT=$(stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- get_root 2>/dev/null | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//' || true)
  if [[ "$CURRENT_FRAUD_ROOT" != "$EXPECTED_FRAUD_ROOT" ]]; then
    echo "  ERROR: Fraud root mismatch (on-chain=0x${CURRENT_FRAUD_ROOT}, expected=0x${EXPECTED_FRAUD_ROOT})" >&2
    echo "  Re-run: npm run redeploy:asp-escrow" >&2
    exit 1
  fi
fi

echo "=== Demo policy (\$1–\$500 bounds) ==="
POLICY_ROOT=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; const t=JSON.parse(readFileSync('./scripts/artifacts/policy_tree.json','utf8')); process.stdout.write(t.root.replace(/^0x/,''))")
BOUNDS=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; const t=readFileSync('./circuits/amount_range/Prover.toml','utf8'); const m=t.match(/policy_bounds_hash = \"([^\"]+)\"/); if(!m) throw new Error('bounds hash missing'); process.stdout.write(m[1].replace(/^0x/,''))")
EXPIRY=4000000000

echo "  coverage_root: 0x$POLICY_ROOT"
echo "  bounds_hash:   0x$BOUNDS"

stellar contract invoke --id "$POLICY_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- register_policy \
  --insurer "$ADMIN" \
  --coverage_root "$POLICY_ROOT" \
  --bounds_hash "$BOUNDS" \
  --expiry_ledger "$EXPIRY"

echo "=== Verifying on-chain bounds hash ==="
ONCHAIN=$(stellar contract invoke --id "$POLICY_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_bounds_hash --insurer "$ADMIN" | tr -d '"')
if [[ "${ONCHAIN,,}" != "0x${BOUNDS,,}" && "${ONCHAIN,,}" != "${BOUNDS,,}" ]]; then
  echo "WARN: on-chain bounds $ONCHAIN != expected 0x$BOUNDS" >&2
  exit 1
fi

echo "=== Demo testnet sync complete ==="
