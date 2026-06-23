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
IDENTITY_FILE="${HOME}/.config/stellar/identity/${PATIENT_IDENTITY}.toml"
if [[ ! -f "$IDENTITY_FILE" ]]; then
  echo "Missing identity file: $IDENTITY_FILE" >&2
  exit 1
fi
PATIENT_SECRET="$(node -e "
const fs = require('fs');
const m = fs.readFileSync(process.argv[1], 'utf8').match(/secret_key\\s*=\\s*\"([^\"]+)\"/);
if (!m) process.exit(1);
process.stdout.write(m[1]);
" "$IDENTITY_FILE")"

echo "=== Funding patient via Friendbot: $PATIENT_PUB ==="
curl -s "https://friendbot.stellar.org?addr=${PATIENT_PUB}" >/dev/null || true
sleep 3

echo "=== Proving demo claim + submit_claim ==="
export PATIENT_SECRET_KEY="$PATIENT_SECRET"
export INSURER_FUND_ADDRESS="${INSURER_FUND_ADDRESS:-$(stellar keys address "$IDENTITY")}"

npx tsx scripts/submit_demo_claim.ts

echo "=== Testnet submit_claim complete ==="
