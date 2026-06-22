#!/usr/bin/env bash
export PATH="$HOME/.bb:$HOME/.nargo/bin:$PATH"
cd /mnt/c/Users/MSI/Desktop/zklaim/circuits
bb write_vk --help > /tmp/bb_help.txt 2>&1
bb prove --help >> /tmp/bb_help.txt 2>&1
bb write_vk -b ./target/policy_validity.json -o ./target/vk >> /tmp/bb_help.txt 2>&1
ls -la ./target/ >> /tmp/bb_help.txt 2>&1
