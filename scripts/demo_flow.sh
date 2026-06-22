#!/usr/bin/env bash
# End-to-end hackathon demo — see docs/requirements.md §13
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== ZKlaim Demo Flow (4 minutes) ==="
echo ""
echo "Demo A — Happy path: ICD J18.9, \$1,200"
echo "Demo B — Deductible crossing: \$800 + \$400 over \$1,000 threshold"
echo "Demo C — Fraud block: unenrolled doctor + blocked billing pattern"
echo ""
echo "Prerequisites: deployed contracts, npm run dev -w app, Freighter on testnet"
echo "Run manually after Phase 7 E2E tests pass."
