#!/usr/bin/env bash
# Continue deploy after partial failure (verifier + some VKs already on-chain).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-aim-soroban-deployer}"
VERIFIER_ID="${3:?usage: deploy_continue.sh network identity verifier_id}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

# shellcheck disable=SC1091
source "$ROOT/.env"
USDC_TOKEN="${USDC_TOKEN_CONTRACT_ID:?}"
# shellcheck disable=SC1091
source "$ROOT/scripts/usdc_circle.sh"

unset CARGO_TARGET_DIR
cd "$ROOT/contracts"
cargo build --workspace --target wasm32v1-none --release
WASM="target/wasm32v1-none/release"
CIRCUITS=(policy_validity amount_range doctor_attestation deductible_accumulator category_nonmembership)

echo "=== Finish VK init on $VERIFIER_ID ==="
for i in 2 3 4; do
  circuit="${CIRCUITS[$i]}"
  vk="$ROOT/circuits/target/bb/$circuit/vk"
  echo "=== VK $i ($circuit) ==="
  stellar contract invoke --id "$VERIFIER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- init \
    --admin "$ADMIN_ADDR" \
    --circuit_id "$i" \
    --vk_bytes "$(xxd -p -c 256 "$vk" | tr -d '\n')"
  sleep 3
done

echo "=== 3. Deploy asp_membership ==="
ASP_MEMBER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_membership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_MEMBER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Member: $ASP_MEMBER_ID"
sleep 2

echo "=== 4. Deploy asp_nonmembership ==="
ASP_FRAUD_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/asp_nonmembership.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR"
echo "ASP Fraud: $ASP_FRAUD_ID"
sleep 2

echo "=== 5. Deploy policy_registry ==="
POLICY_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/policy_registry.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
echo "Policy Registry: $POLICY_ID"
sleep 2

echo "=== 6. Deploy deductible_tracker ==="
TRACKER_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/deductible_tracker.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$TRACKER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --verifier "$VERIFIER_ID" --admin "$ADMIN_ADDR"
echo "Deductible Tracker: $TRACKER_ID"
sleep 2

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
sleep 2

echo "=== 8. Deploy passport_registry ==="
PASSPORT_ID=$(stellar contract deploy \
  --wasm "$ROOT/contracts/$WASM/passport_registry.wasm" \
  --source-account "$IDENTITY" --network "$NETWORK")
stellar contract invoke --id "$PASSPORT_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- init --admin "$ADMIN_ADDR" --claim_escrow "$ESCROW_ID" --verifier "$VERIFIER_ID"
echo "Passport Registry: $PASSPORT_ID"

ENV_OUT="$ROOT/.env"
PRESERVE_VITE_SUPABASE_URL=""
PRESERVE_VITE_SUPABASE_ANON_KEY=""
if [[ -f "$ENV_OUT" ]]; then
  PRESERVE_VITE_SUPABASE_URL="$(grep -E '^VITE_SUPABASE_URL=' "$ENV_OUT" | cut -d= -f2- || true)"
  PRESERVE_VITE_SUPABASE_ANON_KEY="$(grep -E '^VITE_SUPABASE_ANON_KEY=' "$ENV_OUT" | cut -d= -f2- || true)"
fi
{
  echo "STELLAR_NETWORK=$NETWORK"
  echo "STELLAR_RPC_URL=https://soroban-testnet.stellar.org"
  echo "STELLAR_NETWORK_PASSPHRASE=\"Test SDF Network ; September 2015\""
  echo ""
  echo "# Stellar identity for deploy/setup scripts (stellar keys fund $IDENTITY --network testnet)"
  echo "DEPLOYER_IDENTITY=$IDENTITY"
  echo "DEPLOYER_PUBLIC_KEY=$ADMIN_ADDR"
  echo ""
  echo "# Soroban contracts ($NETWORK)"
  echo "VERIFIER_CONTRACT_ID=$VERIFIER_ID"
  echo "ASP_MEMBER_CONTRACT_ID=$ASP_MEMBER_ID"
  echo "ASP_FRAUD_CONTRACT_ID=$ASP_FRAUD_ID"
  echo "POLICY_REGISTRY_CONTRACT_ID=$POLICY_ID"
  echo "DEDUCTIBLE_TRACKER_CONTRACT_ID=$TRACKER_ID"
  echo "CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
  echo "PASSPORT_REGISTRY_CONTRACT_ID=$PASSPORT_ID"
  echo ""
  echo "# Circle testnet USDC (classic issuer + Soroban SAC for claim_escrow payouts)"
  echo "USDC_ISSUER=$ZKLAIM_USDC_ISSUER"
  echo "USDC_TOKEN_CONTRACT_ID=$USDC_TOKEN"
  echo "INSURER_FUND_ADDRESS=$ADMIN_ADDR"
  echo ""
  echo "# Vite app"
  echo "VITE_STELLAR_RPC_URL=https://soroban-testnet.stellar.org"
  echo "VITE_STELLAR_NETWORK_PASSPHRASE=\"Test SDF Network ; September 2015\""
  echo "VITE_CLAIM_ESCROW_CONTRACT_ID=$ESCROW_ID"
  echo "VITE_DEDUCTIBLE_TRACKER_CONTRACT_ID=$TRACKER_ID"
  echo "VITE_ASP_MEMBER_CONTRACT_ID=$ASP_MEMBER_ID"
  echo "VITE_ASP_FRAUD_CONTRACT_ID=$ASP_FRAUD_ID"
  echo "VITE_POLICY_REGISTRY_CONTRACT_ID=$POLICY_ID"
  echo "VITE_PASSPORT_REGISTRY_CONTRACT_ID=$PASSPORT_ID"
  echo "VITE_USDC_TOKEN_CONTRACT_ID=$USDC_TOKEN"
  echo "VITE_USDC_ISSUER=$ZKLAIM_USDC_ISSUER"
  echo "VITE_INSURER_FUND_ADDRESS=$ADMIN_ADDR"
  if [[ -n "$PRESERVE_VITE_SUPABASE_URL" ]]; then
    echo "VITE_SUPABASE_URL=$PRESERVE_VITE_SUPABASE_URL"
  fi
  if [[ -n "$PRESERVE_VITE_SUPABASE_ANON_KEY" ]]; then
    echo "VITE_SUPABASE_ANON_KEY=$PRESERVE_VITE_SUPABASE_ANON_KEY"
  fi
} > "$ENV_OUT"

echo "=== Deployment complete — wrote $ENV_OUT ==="
