#!/usr/bin/env bash
# Force Linux toolchain resolution (avoid Windows npm/node/bb via WSL interop).
export PATH="$HOME/.cargo/bin:$HOME/.nargo/bin:$HOME/.bb:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
export PATH="$(echo "$PATH" | tr ':' '\n' | grep -v '^/mnt/c/' | paste -sd: -)"
