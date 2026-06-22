#!/usr/bin/env bash
# Post-deploy smoke: verify contracts are wired and readable (no full submit_claim — needs live proofs).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"

# shellcheck disable=SC1091
source "$ROOT/.env"

ASP_ID="${ASP_MEMBER_CONTRACT_ID:?}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?}"
ESCROW_ID="${CLAIM_ESCROW_CONTRACT_ID:?}"
ADMIN="$(stellar keys address "$IDENTITY")"

echo "=== Smoke: ASP root ==="
stellar contract invoke --id "$ASP_ID" --source-account "$IDENTITY" --network "$NETWORK" --send no \
  -- get_root

echo "=== Smoke: policy active ==="
stellar contract invoke --id "$POLICY_ID" --source-account "$IDENTITY" --network "$NETWORK" --send no \
  -- is_active --insurer "$ADMIN"

echo "=== Smoke: escrow nullifier not spent ==="
stellar contract invoke --id "$ESCROW_ID" --source-account "$IDENTITY" --network "$NETWORK" --send no \
  -- nullifier_spent --nullifier 0000000000000000000000000000000000000000000000000000000000000001

echo "=== Smoke checks passed ==="
