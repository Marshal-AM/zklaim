#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/wsl_env.sh"

NETWORK="${1:-testnet}"
IDENTITY="${2:-zklaim-deploy}"
ADMIN="$(stellar keys address "$IDENTITY")"

cd "$ROOT"
npm run build:trees

if [[ ! -f .env ]]; then
  echo "Missing .env — run bash scripts/deploy.sh first" >&2
  exit 1
fi
# shellcheck disable=SC1091
source "$ROOT/.env"

ASP_ID="${ASP_MEMBER_CONTRACT_ID:?deploy asp_membership first}"
ASP_FRAUD_ID="${ASP_FRAUD_CONTRACT_ID:?deploy asp_nonmembership first}"
POLICY_ID="${POLICY_REGISTRY_CONTRACT_ID:?deploy policy_registry first}"

echo "=== Inserting doctor leaves from scripts/artifacts/asp_tree.json ==="
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/asp_tree.json', 'utf8'));
for (const d of t.doctors) {
  console.log(d.leaf.replace(/^0x/, ''));
}
" | while read -r leaf; do
  stellar contract invoke --id "$ASP_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- insert_leaf --admin "$ADMIN" --commitment "$leaf" \
    || echo "  (skip duplicate leaf $leaf)"
done

echo "=== Inserting fraud patterns from scripts/artifacts/fraud_tree.json ==="
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const t = JSON.parse(readFileSync('./scripts/artifacts/fraud_tree.json', 'utf8'));
for (const e of t.leaves) {
  console.log(e.billing_pattern_hash.replace(/^0x/, ''));
}
" | while read -r pattern; do
  stellar contract invoke --id "$ASP_FRAUD_ID" --source-account "$IDENTITY" --network "$NETWORK" \
    -- insert_pattern --admin "$ADMIN" --billing_pattern_hash "$pattern" \
    || echo "  (skip duplicate pattern $pattern)"
done

echo "=== Registering demo policy ==="
POLICY_ROOT=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; const t=JSON.parse(readFileSync('./scripts/artifacts/policy_tree.json','utf8')); process.stdout.write(t.root.replace(/^0x/,''))")
BOUNDS=$(node --input-type=module -e "import {readFileSync} from 'node:fs'; const t=readFileSync('./circuits/amount_range/Prover.toml','utf8'); const m=t.match(/policy_bounds_hash = \"([^\"]+)\"/); if(!m) throw new Error('bounds hash missing'); process.stdout.write(m[1].replace(/^0x/,''))")
EXPIRY=4000000000

stellar contract invoke --id "$POLICY_ID" --source-account "$IDENTITY" --network "$NETWORK" \
  -- register_policy \
  --insurer "$ADMIN" \
  --coverage_root "$POLICY_ROOT" \
  --bounds_hash "$BOUNDS" \
  --expiry_ledger "$EXPIRY"

echo "=== ASP + policy seed complete ==="
