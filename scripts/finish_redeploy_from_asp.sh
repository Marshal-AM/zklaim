#!/usr/bin/env bash
# Continue redeploy when asp_membership is already deployed + seeded.
# Usage: bash scripts/finish_redeploy_from_asp.sh testnet aim-soroban-deployer CA7P26...
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/usdc_circle.sh"
# shellcheck disable=SC1091
source "$ROOT/.env"

NETWORK="${1:-testnet}"
IDENTITY="${2:?identity}"
ASP_MEMBER_ID="${3:?asp_member_contract_id}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

VERIFIER_ID="${VERIFIER_CONTRACT_ID:?}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?}"
INSURER="${INSURER_FUND_ADDRESS:-$ADMIN_ADDR}"
WASM="$ROOT/contracts/target/wasm32v1-none/release"
FRAUD_TREE_JSON="$ROOT/scripts/artifacts/fraud_tree.json"
export FRAUD_TREE_JSON

EXPECTED_FRAUD_ROOT=$(node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.FRAUD_TREE_JSON, 'utf8'));
process.stdout.write(t.root.replace(/^0x/i, '').toLowerCase());
")

update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
    if [[ "$(uname -s)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${val}|" "$ROOT/.env"
    else
      sed -i "s|^${key}=.*|${key}=${val}|" "$ROOT/.env"
    fi
  else
    echo "${key}=${val}" >> "$ROOT/.env"
  fi
}

sleep_tx() {
  echo "  (waiting 20s…)"
  sleep 20
}

retry_invoke() {
  local max_attempts=8 attempt=1 log
  while (( attempt <= max_attempts )); do
    log="$(mktemp)"
    if stellar contract invoke "$@" >"$log" 2>&1; then
      cat "$log"
      rm -f "$log"
      return 0
    fi
    cat "$log" >&2
    if grep -qE 'TxBadSeq|Contract not found|transaction submission|502|503|504|timeout|Bad Gateway' "$log"; then
      echo "  (retry $attempt/$max_attempts after 20s…)" >&2
      rm -f "$log"
      sleep 20
      ((attempt++))
      continue
    fi
    rm -f "$log"
    return 1
  done
  return 1
}

echo "=== Finish redeploy from ASP $ASP_MEMBER_ID ==="
ONCHAIN_ASP=$(stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//')
echo "  ASP root on-chain: 0x$ONCHAIN_ASP"

echo "=== Deploy asp_nonmembership ==="
ASP_FRAUD_ID=$(stellar contract deploy \
  --wasm "$WASM/asp_nonmembership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
echo "  Fraud: $ASP_FRAUD_ID"
sleep_tx
retry_invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- init --admin "$ADMIN_ADDR"
sleep_tx

node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync(process.env.FRAUD_TREE_JSON, 'utf8'));
for (const e of t.leaves) {
  console.log(e.billing_pattern_hash.replace(/^0x/, ''));
}
" | while read -r pattern; do
  retry_invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    --send=yes -- insert_pattern --admin "$ADMIN_ADDR" --billing_pattern_hash "$pattern"
  sleep 8
done
sleep_tx

FRAUD_ROOT=$(stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- get_root | tr -d '"' | tr '[:upper:]' '[:lower:]' | sed 's/^0x//')
if [[ "$FRAUD_ROOT" != "$EXPECTED_FRAUD_ROOT" ]]; then
  echo "Fraud root mismatch: $FRAUD_ROOT != $EXPECTED_FRAUD_ROOT" >&2
  exit 1
fi
echo "  Fraud root verified: 0x$FRAUD_ROOT"

echo "=== Deploy deductible_tracker ==="
TRACKER_ID=$(stellar contract deploy \
  --wasm "$WASM/deductible_tracker.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
sleep_tx
retry_invoke --id "$TRACKER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- init --verifier "$VERIFIER_ID" --admin "$ADMIN_ADDR"
sleep_tx

USDC_TOKEN=$(stellar contract id asset --asset "$ZKLAIM_USDC_ASSET" --network "$NETWORK")

echo "=== Deploy claim_escrow ==="
ESCROW_ID=$(stellar contract deploy \
  --wasm "$WASM/claim_escrow.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
sleep_tx
retry_invoke --id "$ESCROW_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- init \
  --admin "$ADMIN_ADDR" \
  --verifier "$VERIFIER_ID" \
  --asp_member "$ASP_MEMBER_ID" \
  --asp_fraud "$ASP_FRAUD_ID" \
  --policy "$POLICY_ID" \
  --tracker "$TRACKER_ID" \
  --usdc_token "$USDC_TOKEN" \
  --insurer_escrow "$INSURER" \
  --coinsurance_bps 2000
sleep_tx

retry_invoke --id "$TRACKER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- set_escrow --escrow "$ESCROW_ID"
sleep_tx

echo "=== Fund escrow (15 USDC) ==="
retry_invoke --id "$USDC_TOKEN" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- transfer --from "$INSURER" --to "$ESCROW_ID" --amount 150000000

echo "=== Deploy passport_registry ==="
PASSPORT_ID=$(stellar contract deploy \
  --wasm "$WASM/passport_registry.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
sleep_tx
retry_invoke --id "$PASSPORT_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  --send=yes -- init --admin "$ADMIN_ADDR" --claim_escrow "$ESCROW_ID" --verifier "$VERIFIER_ID"
sleep_tx

update_env "ASP_MEMBER_CONTRACT_ID" "$ASP_MEMBER_ID"
update_env "VITE_ASP_MEMBER_CONTRACT_ID" "$ASP_MEMBER_ID"
update_env "ASP_FRAUD_CONTRACT_ID" "$ASP_FRAUD_ID"
update_env "VITE_ASP_FRAUD_CONTRACT_ID" "$ASP_FRAUD_ID"
update_env "DEDUCTIBLE_TRACKER_CONTRACT_ID" "$TRACKER_ID"
update_env "VITE_DEDUCTIBLE_TRACKER_CONTRACT_ID" "$TRACKER_ID"
update_env "CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"
update_env "VITE_CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"
update_env "USDC_TOKEN_CONTRACT_ID" "$USDC_TOKEN"
update_env "VITE_USDC_TOKEN_CONTRACT_ID" "$USDC_TOKEN"
update_env "PASSPORT_REGISTRY_CONTRACT_ID" "$PASSPORT_ID"
update_env "VITE_PASSPORT_REGISTRY_CONTRACT_ID" "$PASSPORT_ID"

echo "=== Done ==="
echo "  ASP_MEMBER=$ASP_MEMBER_ID"
echo "  ASP_FRAUD=$ASP_FRAUD_ID"
echo "  TRACKER=$TRACKER_ID"
echo "  ESCROW=$ESCROW_ID"
echo "  PASSPORT=$PASSPORT_ID"

bash "$ROOT/scripts/sync_demo_testnet.sh" "$NETWORK" "$IDENTITY"
