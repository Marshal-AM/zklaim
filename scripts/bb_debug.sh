#!/usr/bin/env bash
export PATH="$HOME/.nargo/bin:$HOME/.bb:$PATH"
cd /mnt/c/Users/MSI/Desktop/zklaim/circuits
bb prove --help > /mnt/c/Users/MSI/Desktop/zklaim/bb_prove_help.txt 2>&1
bb write_vk --help >> /mnt/c/Users/MSI/Desktop/zklaim/bb_prove_help.txt 2>&1
cd policy_validity
nargo execute test >> /mnt/c/Users/MSI/Desktop/zklaim/bb_prove_help.txt 2>&1 || true
bb prove -b ../target/policy_validity.json --input_path Prover.toml -o ../target/proof_test >> /mnt/c/Users/MSI/Desktop/zklaim/bb_prove_help.txt 2>&1 || true
