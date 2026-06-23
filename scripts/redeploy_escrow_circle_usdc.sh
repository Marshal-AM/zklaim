#!/usr/bin/env bash
# Redeploy claim_escrow wired to Circle testnet USDC SAC (not deployer-issued mock USDC).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/usdc_circle.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

CIRCLE_USDC_ISSUER="$ZKLAIM_USDC_ISSUER"
CIRCLE_USDC_ASSET="$ZKLAIM_USDC_ASSET"

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
TRACKER_ID="${DEDUCTIBLE_TRACKER_CONTRACT_ID:?}"
INSURER="${INSURER_FUND_ADDRESS:-$ADMIN_ADDR}"

echo "=== Resolving Circle USDC SAC ==="
USDC_TOKEN=$(stellar contract id asset --asset "$CIRCLE_USDC_ASSET" --network "$NETWORK")
echo "  Issuer: $CIRCLE_USDC_ISSUER"
echo "  SAC:    $USDC_TOKEN"

cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release
WASM="target/wasm32v1-none/release"

echo "=== Deploy claim_escrow (Circle USDC) ==="
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

update_env() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "$ROOT/.env" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ROOT/.env"
  else
    echo "${key}=${val}" >> "$ROOT/.env"
  fi
}

update_env "USDC_ISSUER" "$CIRCLE_USDC_ISSUER"
update_env "USDC_TOKEN_CONTRACT_ID" "$USDC_TOKEN"
update_env "CLAIM_ESCROW_CONTRACT_ID" "$ESCROW_ID"

if [[ -f "$ROOT/.env.example" ]]; then
  sed -i "s|^USDC_ISSUER=.*|USDC_ISSUER=${CIRCLE_USDC_ISSUER}|" "$ROOT/.env.example" 2>/dev/null || true
  sed -i "s|^USDC_TOKEN_CONTRACT_ID=.*|USDC_TOKEN_CONTRACT_ID=${USDC_TOKEN}|" "$ROOT/.env.example"
  sed -i "s|^CLAIM_ESCROW_CONTRACT_ID=.*|CLAIM_ESCROW_CONTRACT_ID=${ESCROW_ID}|" "$ROOT/.env.example"
  grep -q "^USDC_ISSUER=" "$ROOT/.env.example" || \
    sed -i "/^USDC_TOKEN_CONTRACT_ID=/i USDC_ISSUER=${CIRCLE_USDC_ISSUER}" "$ROOT/.env.example"
fi

echo "=== Circle USDC escrow redeploy complete ==="
echo "  USDC_TOKEN_CONTRACT_ID=$USDC_TOKEN"
echo "  CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
