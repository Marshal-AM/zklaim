#!/usr/bin/env bash
set -euo pipefail

export PATH="$HOME/.cargo/bin:$HOME/.nargo/bin:$HOME/.bb:$PATH"

echo "=== ZKlaim WSL Toolchain Verification ==="
echo ""

check() {
  local name="$1"
  local cmd="$2"
  printf "Checking %s... " "$name"
  if out=$(eval "$cmd" 2>&1); then
    echo "OK"
    echo "  $out"
  else
    echo "MISSING"
    return 1
  fi
}

failed=0
check "rustc" "rustc --version" || failed=$((failed + 1))
check "cargo" "cargo --version" || failed=$((failed + 1))
printf "Checking wasm32v1-none... "
if rustup target list --installed | grep -q wasm32v1-none; then
  echo "OK"
else
  echo "MISSING"
  failed=$((failed + 1))
fi
check "stellar-cli" "stellar --version" || failed=$((failed + 1))
check "wasm-pack" "wasm-pack --version" || failed=$((failed + 1))
check "nargo" "nargo --version" || failed=$((failed + 1))
check "bb" "bb --version" || failed=$((failed + 1))

echo ""
if [ "$failed" -eq 0 ]; then
  echo "All Phase 3+ tools: OK"
  exit 0
fi

echo "$failed check(s) failed."
exit 1
