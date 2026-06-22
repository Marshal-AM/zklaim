#!/usr/bin/env bash
set -e
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
cd /mnt/c/Users/MSI/Desktop/zklaim/circuits/policy_validity
echo "=== Prover.toml ==="
wc -l Prover.toml
tail -3 Prover.toml
echo "=== execute ==="
nargo execute test 2>&1 || true
echo "=== execute default ==="
nargo execute 2>&1 || true
