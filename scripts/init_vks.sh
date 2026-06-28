#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN_ADDR="$(stellar keys address "$IDENTITY")"

# shellcheck disable=SC1090
source "$ROOT/.env"

VERIFIER_ID="${VERIFIER_CONTRACT_ID:?set VERIFIER_CONTRACT_ID in .env}"
CIRCUITS=(policy_validity amount_range doctor_attestation deductible_accumulator category_nonmembership)

echo "=== Initializing VKs on $VERIFIER_ID ==="
for i in "${!CIRCUITS[@]}"; do
  circuit="${CIRCUITS[$i]}"
  vk="$ROOT/circuits/target/bb/$circuit/vk"
  if [[ ! -f "$vk" ]]; then
    echo "Missing $vk — run bash scripts/test_circuits.sh first" >&2
    exit 1
  fi
  echo "=== VK $i ($circuit) ==="
  stellar contract invoke --id "$VERIFIER_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- init \
    --admin "$ADMIN_ADDR" \
    --circuit_id "$i" \
    --vk_bytes "$(xxd -p -c 256 "$vk" | tr -d '\n')"
  echo "  VK $i ($circuit) initialized"
  sleep 2
done

echo "=== VK init complete ==="
