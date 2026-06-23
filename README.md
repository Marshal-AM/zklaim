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

Contract IDs are written to `.env`. Settlement uses **Circle testnet USDC only** (issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`, Soroban SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`). After deploy, wire escrow to Circle USDC with `bash scripts/redeploy_escrow_circle_usdc.sh testnet zklaim-deploy`. Fund the insurer escrow with `bash scripts/fund_usdc.sh` (swap XLM → USDC on deployer). Optional third arg sends USDC to the patient demo wallet: `bash scripts/fund_usdc.sh testnet zklaim-deploy 500000000`.

**Prover alignment:** use **bb 0.87.0** with `--oracle_hash keccak` (matches the on-chain Fiat–Shamir transcript). Noir stays at **1.0.0-beta.3**. After changing circuits, run `bash scripts/test_circuits.sh` then `bash scripts/init_vks.sh` to refresh on-chain VKs.

## Phase 5 — Client-side proof engine (WSL)

Browser/Node proof orchestrator in `client/proof_gen/` and Soroban tx builder in `client/stellar_tx/`:

```bash
# Prerequisites: Phase 3 circuits + trees
npm run build:trees
npm run build:circuits          # copies ACIR JSON to client/wasm/

# Prove demo claim (Node, ~60–120s)
npm run test:proof-gen

# Optional: build tx + simulate/submit (needs .env + PATIENT_SECRET_KEY)
npx tsx scripts/submit_demo_claim.ts --simulate-only
```

## Phase 6 — Frontend application

Patient, provider, and admin portals in `app/`:

```bash
npm install
npm run sync:app-assets   # copy trees + circuit WASM to app/public/
npm run dev               # http://localhost:5173 (COOP/COEP for bb.js workers)
```

**Flow:** Provider connects Freighter → looks up patient by Stellar address (Supabase) → encrypts claim → delivers to patient inbox → Patient decrypts locally → 4-circuit proof progress → Freighter signs `submit_claim` → USDC settlement receipt. QR/deep link remains a fallback.

Requires Freighter on **testnet**, `.env` with `VITE_*` contract IDs (see `.env.example`), and `npm run build:circuits` for WASM assets.

### Supabase (optional — patient directory + encrypted inbox)

Supabase stores **only** Stellar addresses, box **public** keys, and **encrypted** claim tokens. No medical plaintext, no secret keys.

1. Create a Supabase project and run [`supabase/migrations/001_zklaim_coordination.sql`](supabase/migrations/001_zklaim_coordination.sql) in the SQL Editor.
2. In Project Settings → API, copy the URL and `anon` key into `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Ensure **Realtime** is enabled for `claim_deliveries` (included in the migration).

**With Supabase:** Patient onboarding registers their public key; doctors enter only the patient Stellar address; claims appear in the patient inbox automatically. **Providers** register their own Freighter wallet on the Provider tab (links to demo MD-001 ASP credential).

**Without Supabase:** Doctors paste the patient's public encryption key manually; claims arrive via QR/deep link only. Use deployer wallet as provider or edit `physicians.json`.

Run both SQL migrations: `001_zklaim_coordination.sql` and `002_provider_profiles.sql`.

```bash
npm run test:app
npm run build:app
```


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
