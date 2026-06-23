#!/usr/bin/env bash
# Redeploy deductible_tracker (genesis fix) + claim_escrow (rewire tracker).
# Reuses verifier, ASP, policy, USDC from existing .env.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

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
ASP_MEMBER_ID="${ASP_MEMBER_CONTRACT_ID:?}"
ASP_FRAUD_ID="${ASP_FRAUD_CONTRACT_ID:?}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?}"
USDC_TOKEN="${USDC_TOKEN_CONTRACT_ID:?}"
INSURER="${INSURER_FUND_ADDRESS:-$ADMIN_ADDR}"

echo "=== Building contracts (wasm32v1-none) ==="
cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release
WASM="target/wasm32v1-none/release"

echo "=== Deploy deductible_tracker (genesis fix) ==="
TRACKER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/deductible_tracker.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$TRACKER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --verifier "$VERIFIER_ID"
echo "Deductible Tracker: $TRACKER_ID"

echo "=== Deploy claim_escrow (new tracker wire) ==="
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

# Update .env in place (preserve other keys)
update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ROOT/.env"
  else
    echo "${key}=${val}" >> "$ROOT/.env"
  fi
}

update_env "DEDUCTIBLE_TRACKER_CONTRACT_ID" "$TRACKER_ID"
update_env "CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"

# Mirror to .env.example for committed reference
if [[ -f "$ROOT/.env.example" ]]; then
  sed -i "s|^DEDUCTIBLE_TRACKER_CONTRACT_ID=.*|DEDUCTIBLE_TRACKER_CONTRACT_ID=${TRACKER_ID}|" "$ROOT/.env.example"
  sed -i "s|^CLAIM_ESCROW_CONTRACT_ID=.*|CLAIM_ESCROW_CONTRACT_ID=${ESCROW_ID}|" "$ROOT/.env.example"
fi

echo "=== Redeploy complete ==="
echo "  DEDUCTIBLE_TRACKER_CONTRACT_ID=$TRACKER_ID"
echo "  CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
