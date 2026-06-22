# ZKlaim

Private medical claims on Stellar with zero-knowledge proofs.

**Pitch:** Prove your insurance claim is valid. Receive payment. Reveal nothing about your diagnosis.

See [docs/requirements.md](docs/requirements.md) for the full specification and [docs/implementation.md](docs/implementation.md) for the phase-wise build plan.

## Prerequisites

**Windows:** Node.js >= 20 for the app and tree builders.

**WSL Ubuntu:** Noir, Barretenberg, Rust, stellar-cli, and wasm-pack (Phase 3+). Native Windows installs are not supported for these tools.

| Tool | Version | Install (inside WSL) |
|---|---|---|
| Node.js | >= 20 | [nodejs.org](https://nodejs.org/) on Windows |
| Rust + cargo | stable | `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` |
| wasm32v1-none | Soroban target | `rustup target add wasm32v1-none` |
| stellar-cli | 27+ | `cargo install --locked stellar-cli --features opt` |
| wasm-pack | latest | `cargo install wasm-pack` |
| nargo | 1.0.0-beta.3 | `noirup -v 1.0.0-beta.3` via [noirup](https://raw.githubusercontent.com/noir-lang/noirup/main/install) |
| bb | 0.87.0 | `bbup -v 0.87.0` via [bbup](https://raw.githubusercontent.com/AztecProtocol/aztec-packages/refs/heads/next/barretenberg/bbup/install) |
| soroban-sdk | 26.1.0 | workspace `contracts/Cargo.toml` |

Install everything in WSL in one shot:

```powershell
npm run install:toolchain
```

Or run `scripts/install_toolchain_wsl.sh` directly inside your WSL Ubuntu terminal.

Verify installation:

```powershell
npm run verify:toolchain
```

## Quick start

Use **WSL Ubuntu** as your terminal for Phase 3+ (Noir, bb, Soroban).

```bash
# Inside WSL, from repo root (/mnt/c/Users/.../zklaim)
npm install
npm run verify:toolchain
npm test                   # Phase 1-2: trees + vitest + app build
npm run build:circuits     # Phase 3: vectors + nargo test + bb prove + WASM
npm run build:contracts    # Phase 4: Soroban WASM (WSL)
npm run test:contracts     # Phase 4: soroban-sdk unit tests (WSL)
npm run dev                # http://localhost:5173
```

Individual steps:

```bash
npm run build:trees
npm run test:trees
npm run generate:circuit-vectors
npm run test:circuits      # nargo test + bb prove/verify (no WASM)
npm run build:app
npm run typecheck
```

## Phase 4 — Soroban contracts (WSL)

Build, test, and deploy the six contracts (`ultrahonk_verifier`, `asp_membership`, `asp_nonmembership`, `policy_registry`, `deductible_tracker`, `claim_escrow`):

```bash
# Prerequisites: circuits proven (Phase 3)
npm run test:circuits
npm run build:contracts
npm run test:contracts      # 8 unit tests across crates

# Testnet deploy (creates identity zklaim-deploy if missing)
stellar keys generate zklaim-deploy
stellar keys fund zklaim-deploy --network testnet
bash scripts/deploy.sh testnet zklaim-deploy
bash scripts/setup_asp.sh testnet zklaim-deploy
bash scripts/init_vks.sh testnet zklaim-deploy   # after re-proving circuits
bash scripts/smoke_claim.sh testnet zklaim-deploy
```

Contract IDs are written to `.env`. If `USDC_TOKEN_CONTRACT_ID` is unset, `deploy.sh` issues a mock `USDC` SAC from the deployer account.

**Prover alignment:** use **bb 0.87.0** with `--oracle_hash keccak` (matches the on-chain Fiat–Shamir transcript). Noir stays at **1.0.0-beta.3**. After changing circuits, run `bash scripts/test_circuits.sh` then `bash scripts/init_vks.sh` to refresh on-chain VKs.

## Stellar testnet

```powershell
powershell -File scripts/setup_testnet.ps1
```

Copy `.env.example` to `.env` and fill contract IDs after Phase 4 deploy.

## Repository layout

```
circuits/     # Noir ZK circuits (4 + poseidon_reference)
contracts/    # Six Soroban smart contracts
client/       # Browser proof engine + WASM
app/          # React patient / provider / admin UI
scripts/      # Tree builders, deploy, ASP setup
tests/        # Integration tests
```

## ICD demo subset

Policy trees use a **demo subset** of ICD-10 codes per coverage range (~20–50 codes), not the full corpus. Demo code **J18.9** (pneumonia) is always included for hackathon Demo A.

## Cryptography

All Merkle trees use **Poseidon2** on BN254, depth **10**, matching Noir `std::hash::poseidon2` and Soroban CAP-0075.

Nullifier: `Poseidon2([policy_id, visit_date, diagnosis_secret, random_nonce], 4)`

## License

Confidential — ZK on Stellar Hackathon, June 2026
