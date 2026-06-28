#!/usr/bin/env bash
# End-to-end testnet submit_claim using demo proofs + patient wallet.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
PATIENT_IDENTITY="${3:-zklaim-patient}"

cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/.env"

if ! stellar keys public-key "$PATIENT_IDENTITY" &>/dev/null; then
  echo "=== Generating patient identity: $PATIENT_IDENTITY ==="
  stellar keys generate "$PATIENT_IDENTITY"
fi

PATIENT_PUB="$(stellar keys address "$PATIENT_IDENTITY")"
echo "=== Funding patient via Friendbot: $PATIENT_PUB ==="
curl -s "https://friendbot.stellar.org?addr=${PATIENT_PUB}" >/dev/null || true
sleep 3

echo "=== Proving demo claim + submit_claim ==="
export PATIENT_IDENTITY="$PATIENT_IDENTITY"
export INSURER_FUND_ADDRESS="${INSURER_FUND_ADDRESS:-$(stellar keys address "$IDENTITY")}"

npx tsx scripts/submit_demo_claim.ts

echo "=== Testnet submit_claim complete ==="
