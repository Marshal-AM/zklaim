#!/usr/bin/env bash
# fund_usdc.sh — Circle testnet USDC for ZKlaim settlement.
#   1. change-trust on deployer (insurer escrow wallet)
#   2. path-payment XLM → USDC on deploye
#   3. optional: send USDC to patient demo wallet (GAQ)
#
# Usage:
#   bash scripts/fund_usdc.sh [network] [identity] [usdc_to_gaq_stroops]
# Default keeps all swapped USDC on the insurer (INSURER_FUND_ADDRESS / deployer).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"
# shellcheck disable=SC1091
source "$ROOT/scripts/usdc_circle.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
GAQ_PAYMENT="${3:-0}"
DEPLOYER="$(stellar keys address "$IDENTITY")"
GAQ="GAQ5S6CJWD5K4SAKNSYUEOAB7FT2JFUJY4XSZWKODS2NLHMN3IS467O6"
USDC="$ZKLAIM_USDC_ASSET"

send_tx() {
  stellar tx new "$@" \
    --source-account "$IDENTITY" \
    --network "$NETWORK" \
    --build-only \
    -q \
  | stellar tx sign \
      --sign-with-key "$IDENTITY" \
      --network "$NETWORK" \
  | stellar tx send \
      --network "$NETWORK"
}

echo ">>> [1/3] Ensuring Circle USDC trustline for insurer $DEPLOYER …"
if send_tx change-trust \
    --line "$USDC" 2>&1 | grep -q "op_already_exists\|CHANGE_TRUST_ALREADY_EXIST"; then
  echo "    Trustline already exists — skipping."
else
  echo "    Trustline created."
fi

# dest-amount 1000000000 = 100 USDC (7 decimals)
echo ">>> [2/3] Swapping up to 5000 XLM for 100 Circle USDC → $DEPLOYER (insurer escrow) …"
send_tx path-payment-strict-receive \
  --send-asset native \
  --send-max 50000000000 \
  --destination "$DEPLOYER" \
  --dest-asset "$USDC" \
  --dest-amount 1000000000
echo "    Insurer funded with Circle USDC."

if [[ "$GAQ_PAYMENT" != "0" ]]; then
  echo ">>> [3/3] Sending $GAQ_PAYMENT stroops USDC to patient demo wallet ($GAQ) …"
  send_tx payment \
    --destination "$GAQ" \
    --asset "$USDC" \
    --amount "$GAQ_PAYMENT"
  echo "    Patient demo payment submitted."
else
  echo ">>> [3/3] Skipping patient payment (USDC stays on insurer for claim payouts)."
fi

echo ""
echo "✅  Circle USDC funding complete (issuer $ZKLAIM_USDC_ISSUER)."
