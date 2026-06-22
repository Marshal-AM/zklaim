#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

echo "=== Deploying ZKlaim contracts to $NETWORK (identity: $IDENTITY) ==="

if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1090
  source "$ROOT/.env"
fi

deploy_mock_usdc() {
  echo "=== Deploying mock USDC SAC (issuer=$ADMIN_ADDR) ==="
  stellar tx new payment \
    --source-account "$IDENTITY" \
    --destination "$ADMIN_ADDR" \
    --asset "USDC:$ADMIN_ADDR" \
    --amount 100000000000 \
    --network "$NETWORK" \
    | stellar tx sign --source-account "$IDENTITY" --network "$NETWORK" \
    | stellar tx send --network "$NETWORK"
  stellar contract asset deploy \
    --asset "USDC:$ADMIN_ADDR" \
    --source-account "$IDENTITY" \
    --network "$NETWORK"
}

USDC_TOKEN="${USDC_TOKEN_CONTRACT_ID:-}"
if [[ -z "$USDC_TOKEN" ]]; then
  USDC_TOKEN="$(deploy_mock_usdc | tail -1)"
  echo "USDC_TOKEN_CONTRACT_ID=$USDC_TOKEN"
fi

cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release

WASM="target/wasm32v1-none/release"
CIRCUITS=(policy_validity amount_range doctor_attestation deductible_accumulator)

echo "=== 1. Deploy ultrahonk_verifier ==="
VERIFIER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/ultrahonk_verifier.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
echo "Verifier: $VERIFIER_ID"

stellar contract invoke --id "$VERIFIER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init_admin --admin "$ADMIN_ADDR"

echo "=== 2. Initialize VKs (circuit_id 0-3) ==="
for i in "${!CIRCUITS[@]}"; do
  circuit="${CIRCUITS[$i]}"
  vk="$ROOT/circuits/target/bb/$circuit/vk"
  if [[ ! -f "$vk" ]]; then
    echo "Missing $vk — run bash scripts/test_circuits.sh first" >&2
    exit 1
  fi
  stellar contract invoke --id "$VERIFIER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- init \
    --admin "$ADMIN_ADDR" \
    --circuit_id "$i" \
    --vk_bytes "$(xxd -p -c 256 "$vk" | tr -d '\n')"
  echo "  VK $i ($circuit) initialized"
done

echo "=== 3. Deploy asp_membership ==="
ASP_MEMBER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_membership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Member: $ASP_MEMBER_ID"

echo "=== 4. Deploy asp_nonmembership ==="
ASP_FRAUD_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_nonmembership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Fraud: $ASP_FRAUD_ID"

echo "=== 5. Deploy policy_registry ==="
POLICY_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/policy_registry.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
echo "Policy Registry: $POLICY_ID"

echo "=== 6. Deploy deductible_tracker ==="
TRACKER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/deductible_tracker.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$TRACKER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --verifier "$VERIFIER_ID"
echo "Deductible Tracker: $TRACKER_ID"

echo "=== 7. Deploy claim_escrow ==="
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
  --insurer_escrow "$ADMIN_ADDR" \
  --coinsurance_bps 2000
echo "Claim Escrow: $ESCROW_ID"

ENV_OUT="$ROOT/.env"
touch "$ENV_OUT"
{
  echo "STELLAR_NETWORK=$NETWORK"
  echo "STELLAR_RPC_URL=https://soroban-testnet.stellar.org"
  echo "STELLAR_NETWORK_PASSPHRASE=\"Test SDF Network ; September 2015\""
  echo "DEPLOYER_IDENTITY=$IDENTITY"
  echo "DEPLOYER_PUBLIC_KEY=$ADMIN_ADDR"
  echo "VERIFIER_CONTRACT_ID=$VERIFIER_ID"
  echo "ASP_MEMBER_CONTRACT_ID=$ASP_MEMBER_ID"
  echo "ASP_FRAUD_CONTRACT_ID=$ASP_FRAUD_ID"
  echo "POLICY_REGISTRY_CONTRACT_ID=$POLICY_ID"
  echo "DEDUCTIBLE_TRACKER_CONTRACT_ID=$TRACKER_ID"
  echo "CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
  echo "USDC_TOKEN_CONTRACT_ID=$USDC_TOKEN"
  echo "INSURER_FUND_ADDRESS=$ADMIN_ADDR"
} > "$ENV_OUT"

echo "=== Deployment complete — wrote $ENV_OUT ==="
