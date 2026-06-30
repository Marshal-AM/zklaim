#!/usr/bin/env bash
# End-to-end testnet submit_claim using demo proofs + patient wallet from .env keys.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"

cd "$ROOT"
# shellcheck disable=SC1091
source "$ROOT/.env"

if [[ -z "${PATIENT_SECRET_KEY:-}" && -z "${PATIENT_PUBLIC_KEY:-}" ]]; then
  echo "ERROR: Set PATIENT_SECRET_KEY (or PATIENT_PUBLIC_KEY for --simulate-only) in .env"
  echo "  Do not use stellar CLI identities for runtime submit — use explicit env keys."
  exit 1
fi

if [[ -n "${PATIENT_SECRET_KEY:-}" ]]; then
  PATIENT_PUB="$(node -e "const {Keypair}=require('@stellar/stellar-sdk'); console.log(Keypair.fromSecret(process.env.PATIENT_SECRET_KEY).publicKey())")"
  echo "=== Funding patient via Friendbot: $PATIENT_PUB ==="
  curl -s "https://friendbot.stellar.org?addr=${PATIENT_PUB}" >/dev/null || true
  sleep 3
else
  PATIENT_PUB="${PATIENT_PUBLIC_KEY}"
  echo "=== Using PATIENT_PUBLIC_KEY (simulate-only or pre-funded): $PATIENT_PUB ==="
fi

export PATIENT_PUBLIC_KEY="$PATIENT_PUB"
export INSURER_FUND_ADDRESS="${INSURER_FUND_ADDRESS:-${DEPLOYER_PUBLIC_KEY:-}}"

echo "=== Proving demo claim + submit_claim ==="
npx tsx scripts/submit_demo_claim.ts

echo "=== Testnet submit_claim complete ==="
