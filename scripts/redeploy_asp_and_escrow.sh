#!/usr/bin/env bash
# Fresh asp_membership (3 leaves, root matches asp_tree.json) + new claim_escrow wire-up.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/usdc_circle.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

if [[ ! -f "$ROOT/.env" ]]; then
  echo "Missing .env — run bash scripts/deploy.sh first" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$ROOT/.env"

VERIFIER_ID="${VERIFIER_CONTRACT_ID:?}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?}"
TRACKER_ID="${DEDUCTIBLE_TRACKER_CONTRACT_ID:?}"
USDC_TOKEN=$(stellar contract id asset --asset "$ZKLAIM_USDC_ASSET" --network "$NETWORK")
INSURER="${INSURER_FUND_ADDRESS:-$ADMIN_ADDR}"

ASP_TREE_JSON="$ROOT/scripts/artifacts/asp_tree.json"
FRAUD_TREE_JSON="$ROOT/scripts/artifacts/fraud_tree.json"
export ASP_TREE_JSON FRAUD_TREE_JSON

EXPECTED_ASP_ROOT=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.ASP_TREE_JSON, 'utf8'));
process.stdout.write(t.root.replace(/^0x/i, '').toLowerCase());
")

EXPECTED_FRAUD_ROOT=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.FRAUD_TREE_JSON, 'utf8'));
process.stdout.write(t.root.replace(/^0x/i, '').toLowerCase());
")

echo "=== Building contracts ==="
cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release
WASM="target/wasm32v1-none/release"

echo "=== Deploy asp_membership (fresh tree) ==="
ASP_MEMBER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_membership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Member: $ASP_MEMBER_ID"

echo "=== Insert 3 doctor leaves (asp_tree.json order) ==="
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.ASP_TREE_JSON, 'utf8'));
for (const d of t.doctors) {
  console.log(d.leaf.replace(/^0x/, ''));
}
" | while read -r leaf; do
  stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- insert_leaf --admin "$ADMIN_ADDR" --commitment "$leaf"
done

ONCHAIN_ROOT=$(stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//')
if [[ "$ONCHAIN_ROOT" != "$EXPECTED_ASP_ROOT" ]]; then
  echo "ASP root mismatch: on-chain=$ONCHAIN_ROOT expected=$EXPECTED_ASP_ROOT" >&2
  exit 1
fi
echo "ASP root verified: 0x$ONCHAIN_ROOT"

echo "=== Deploy asp_nonmembership (fresh fraud tree) ==="
ASP_FRAUD_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_nonmembership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Fraud: $ASP_FRAUD_ID"

echo "=== Insert fraud patterns (fraud_tree.json order) ==="
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.FRAUD_TREE_JSON, 'utf8'));
for (const e of t.leaves) {
  console.log(e.billing_pattern_hash.replace(/^0x/, ''));
}
" | while read -r pattern; do
  stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- insert_pattern --admin "$ADMIN_ADDR" --billing_pattern_hash "$pattern"
done

FRAUD_ONCHAIN_ROOT=$(stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//')
if [[ "$FRAUD_ONCHAIN_ROOT" != "$EXPECTED_FRAUD_ROOT" ]]; then
  echo "Fraud root mismatch: on-chain=$FRAUD_ONCHAIN_ROOT expected=$EXPECTED_FRAUD_ROOT" >&2
  exit 1
fi
echo "Fraud root verified: 0x$FRAUD_ONCHAIN_ROOT"

echo "=== Deploy claim_escrow (wire new ASP + fraud) ==="
ESCROW_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/claim_escrow.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ESCROW_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init \
  --admin "$ADMIN_ADDR" \
  --verifier "$VERIFIER_ID" \
  --asp_member "$ASP_MEMBER_ID" \
  --asp_fraud "$ASP_FRAUD_ID" \
  --policy "$POLICY_ID" \
  --tracker "$TRACKER_ID" \
  --usdc_token "$USDC_TOKEN" \
  --insurer_escrow "$INSURER" \
  --coinsurance_bps 2000
echo "Claim Escrow: $ESCROW_ID"

echo "=== Fund claim escrow with USDC (insurer → contract) ==="
# 50 USDC reserve for demo payouts (7 decimals)
stellar contract invoke --id "$USDC_TOKEN" --source-account "$IDENTITY" --network "$NETWORK" \
  -- transfer --from "$INSURER" --to "$ESCROW_ID" --amount 500000000

update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ROOT/.env"
  else
    echo "${key}=${val}" >> "$ROOT/.env"
  fi
}

update_env "ASP_MEMBER_CONTRACT_ID" "$ASP_MEMBER_ID"
update_env "VITE_ASP_MEMBER_CONTRACT_ID" "$ASP_MEMBER_ID"
update_env "ASP_FRAUD_CONTRACT_ID" "$ASP_FRAUD_ID"
update_env "VITE_ASP_FRAUD_CONTRACT_ID" "$ASP_FRAUD_ID"
update_env "CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"
update_env "VITE_CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"
update_env "USDC_TOKEN_CONTRACT_ID" "$USDC_TOKEN"
update_env "VITE_USDC_TOKEN_CONTRACT_ID" "$USDC_TOKEN"

echo "=== Redeploy ASP + fraud + escrow complete ==="
echo "  ASP_MEMBER_CONTRACT_ID=$ASP_MEMBER_ID"
echo "  ASP_FRAUD_CONTRACT_ID=$ASP_FRAUD_ID"
echo "  CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
echo "Restart npm run dev so Vite picks up new contract IDs."
