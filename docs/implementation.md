# ZKlaim — Phase-wise Implementation Plan

This document is the **execution guide** for building ZKlaim. It follows the vision, architecture, cryptography, and component design defined in [requirements.md](./requirements.md) exactly. When in doubt, **requirements.md is authoritative**.

**Hackathon:** ZK on Stellar — June 2026  
**Pitch:** Prove your insurance claim is valid. Receive payment. Reveal nothing about your diagnosis.

---

## Vision & Architecture (from requirements.md)

ZKlaim is a zero-knowledge insurance claim settlement system on Stellar testnet. A patient submits a medical claim and receives USDC in under 60 seconds. The blockchain, insurer, and third parties never learn the diagnosis, doctor identity, or exact claim amount.

The system composes Stellar Protocol 22, 25 (X-Ray), and 26 (Yardstick) primitives:

| Primitive | Stellar CAP | Role in ZKlaim |
|---|---|---|
| BN254 (`g1_add`, `g1_mul`, `multi_pairing_check`) | CAP-0074 | UltraHonk verification; Pedersen amount commitments |
| BN254 MSM + scalar field ops | CAP-0080 | Deductible accumulator batch verification |
| Poseidon / Poseidon2 | CAP-0075 | Nullifiers, Merkle trees, accumulator state |
| Checked 256-bit arithmetic | CAP-0082 | USDC payout calculations in claim escrow |
| Precise TTL control | CAP-0078 | Nullifier / commitment storage lifecycle |

**Foundation:** Nethermind [PoolStellar](https://github.com/NethermindEth/stellar-private-payments) (Privacy Pools pattern) extended with four domain-specific Noir circuits and a six-contract Soroban architecture.

**On-chain record after settlement:** one nullifier, one Merkle root update, one USDC transfer — no diagnosis, no amount in public inputs, no doctor name.

---

## Repository Structure (requirements §7.1)

```
zklaim/
├── circuits/                     # Noir ZK circuits
│   ├── policy_validity/          # Circuit 1: ICD coverage check
│   ├── amount_range/             # Circuit 2: Pedersen range proof
│   ├── doctor_attestation/       # Circuit 3: ASP membership proof
│   └── deductible_accumulator/   # Circuit 4: Recursive state updater
├── contracts/                    # Soroban smart contracts (Rust)
│   ├── ultrahonk_verifier/       # On-chain UltraHonk proof verifier
│   ├── asp_membership/           # Doctor ASP Merkle membership tree
│   ├── asp_nonmembership/        # Fraud ASP sparse Merkle tree
│   ├── policy_registry/          # Insurer policy commitment store
│   ├── claim_escrow/             # USDC settlement + nullifier registry
│   └── deductible_tracker/       # On-chain accumulator state
├── client/                       # Browser-side proving engine
│   ├── wasm/                     # Compiled Noir circuits as WASM
│   ├── proof_gen/                # TypeScript proof orchestrator
│   └── stellar_tx/               # Soroban transaction builder
├── app/                          # React frontend
│   ├── patient/                  # Patient claim submission UI
│   ├── provider/                 # Doctor attestation UI
│   └── admin/                    # Insurer / ASP admin panel
├── scripts/                      # Deploy + test automation
│   ├── deploy.sh                 # Contract deployment to testnet
│   ├── setup_asp.sh              # Populate doctor ASP tree
│   └── demo_flow.sh              # End-to-end demo runner
└── tests/                        # Integration tests
```

---

## End-to-End Data Flow (requirements §7.2)

```mermaid
sequenceDiagram
    participant Provider as app/provider
    participant Patient as app/patient
    participant Prover as client/proof_gen
    participant Escrow as claim_escrow
    participant Verifier as ultrahonk_verifier

    Provider->>Patient: ECIES encrypted claim blob (QR/deep link)
    Patient->>Prover: Decrypt locally; assemble circuit inputs
    Prover->>Prover: Parallel proofs: policy, amount, doctor
    Prover->>Prover: Sequential: deductible_accumulator
    Patient->>Escrow: submit_claim (single Soroban tx)
    Escrow->>Verifier: verify x4 (circuit_id 0-3)
    Escrow->>Escrow: ASP checks, nullifier, USDC transfer
```

1. Doctor creates signed claim blob `{ icd_code, amount, visit_date, doctor_sig, policy_id }`, encrypts with ECIES (patient public key), delivers off-chain. IPFS CID may be committed on-chain for selective disclosure (view keys).
2. Patient decrypts in browser; sensitive data stays in JS memory only.
3. `client/proof_gen` runs **three circuits in parallel** (policy, amount, doctor), then **deductible accumulator** (depends on amount commitment from circuit 2).
4. `client/stellar_tx` builds a transaction calling `claim_escrow.submit_claim`.
5. On-chain: `claim_escrow` cross-calls `ultrahonk_verifier` (×4), `asp_membership`, `asp_nonmembership`, `policy_registry`, `deductible_tracker`; stores nullifier; transfers USDC.

---

## Cryptographic Constants (requirements §4.3, §8, §9)

All hashing uses **Poseidon2** in the BN254 field, matching Noir `std::hash::poseidon2::Poseidon2` and Soroban host functions.

| Use | Formula |
|---|---|
| Policy coverage leaf | `Poseidon2([icd_code], 1)` |
| Merkle internal node | `Poseidon2([left, right], 2)` |
| Merkle depth | **10** (`[Field; 10]` paths in circuits) |
| Policy commitment (on-chain) | `Poseidon2([policy_id, coverage_mask, expiry_timestamp], 3)` |
| Policy circuit commitment check | `Poseidon2([icd_code, policy_secret], 2)` |
| Claim hash (links circuits) | `Poseidon2([visit_date, policy_id, nonce], 3)` |
| Amount bounds hash | `Poseidon2([floor_cents, ceiling_cents], 2)` |
| Doctor enrollment leaf | `Poseidon2([license_hash, specialty_code, jurisdiction_hash], 3)` |
| Doctor ASP leaf (circuit) | `Poseidon2([doctor_secret], 1)` |
| Doctor commitment | `Poseidon2([doctor_secret], 1)` |
| Attestation hash | `Poseidon2([doctor_secret, claim_hash], 2)` |
| Accumulator prev commit | `Poseidon2([prev_accumulator_secret], 1)` |
| Accumulator new commit | `Poseidon2([prev_accumulator_secret, new_amount, new_amount_blinding], 3)` |
| Nullifier | `Poseidon2([policy_id, visit_date, diagnosis_secret, random_nonce], 4)` |
| Fraud billing pattern | `Poseidon2([icd_category_hash, amount_bucket_hash, provider_type_hash], 3)` |

**Coverage tree semantics:** Leaf nodes represent ICD-10 coverage categories (e.g. J00–J99 Respiratory). The policy circuit proves a specific `icd_code` hashes to a leaf in the coverage Merkle tree without revealing the code.

---

## Phase 1 — Repo, Toolchain & Project Skeleton

**Blocks on:** nothing  
**Key output:** Dev environment ready; empty workspace compiles

### 1.1 Scaffold the monorepo

Create the full directory tree from requirements §7.1:

- **circuits/** — Noir workspace root `Nargo.toml` + four member packages (`policy_validity`, `amount_range`, `doctor_attestation`, `deductible_accumulator`), each with stub `src/main.nr`
- **contracts/** — Cargo workspace with six Soroban crates (stub `lib.rs` per contract)
- **client/** — `wasm/`, `proof_gen/`, `stellar_tx/` placeholders
- **app/** — Vite + React 18 + TypeScript scaffold with `patient/`, `provider/`, `admin/` route stubs
- **scripts/** — `deploy.sh`, `setup_asp.sh`, `demo_flow.sh` stubs
- **tests/** — placeholder for `e2e_claim_flow.ts`

Add root `.gitignore`, `README.md` (setup instructions), and `.env.example`.

### 1.2 Install toolchain (requirements §8.1, §9.1)

| Tool | Version | Purpose | Install |
|---|---|---|---|
| nargo | ≥ 1.0.0-beta.3 | Noir compiler | `curl -L noirup.dev \| bash` |
| bb | ≥ 0.63.0 | UltraHonk keys + WASM | `bbup -v 0.63.0` |
| wasm-pack | latest | Rust WASM bundles | `cargo install wasm-pack` |
| stellar-cli | latest (opt) | Deploy / invoke | `cargo install --locked stellar-cli --features opt` |
| Rust target | wasm32v1-none | Soroban WASM | `rustup target add wasm32v1-none` |
| Node.js | ≥ 20 | app + client + tests | user install |

**Frontend / client libraries (requirements §11.1, §14.3):**

- `@noir-lang/noir_js`, `@aztec/bb.js` — browser proving
- `@stellar/stellar-sdk` ≥ 13.x — Soroban RPC + tx building
- `@stellar/freighter-api` — wallet
- Tailwind CSS, Zustand — app UI

**Reference repos to fork in later phases:**

- [indextree/ultrahonk_soroban_contract](https://github.com/indextree/ultrahonk_soroban_contract)
- [NethermindEth/stellar-private-payments](https://github.com/NethermindEth/stellar-private-payments)

### 1.3 Environment configuration

`.env.example`:

```env
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
VERIFIER_CONTRACT_ID=
ASP_MEMBER_CONTRACT_ID=
ASP_FRAUD_CONTRACT_ID=
POLICY_REGISTRY_CONTRACT_ID=
CLAIM_ESCROW_CONTRACT_ID=
DEDUCTIBLE_TRACKER_CONTRACT_ID=
USDC_TOKEN_CONTRACT_ID=
```

Configure Stellar testnet:

```bash
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

Fund deployer account via Friendbot. Optional local dev:

```bash
stellar container start -t future --name local --limits unlimited
```

### 1.4 Phase 1 exit criteria

- [ ] `nargo check --workspace` passes (stub circuits)
- [ ] `cargo build --workspace --target wasm32v1-none --release` passes (stub contracts)
- [ ] App dev server starts (`app/`)
- [ ] README documents full toolchain setup

---

## Phase 2 — Merkle Tree Infrastructure & Off-Chain Data

**Blocks on:** Phase 1  
**Key output:** Tree roots + membership/non-membership proofs for all ASP and policy data

Everything in Phases 3–4 depends on Poseidon2-aligned tree builders that match the Noir circuits and Soroban contracts exactly.

### 2.1 Shared Poseidon2 library (scripts support)

Add TypeScript helpers under `scripts/lib/` (or `client/proof_gen/lib/`) used by tree builders and later by the client:

- `poseidon2.ts` — BN254 Poseidon2 matching Noir; **must** pass alignment test against a Noir reference circuit
- `field.ts` — encode ICD codes, license hashes, addresses as field elements
- `merkle.ts` — binary Merkle tree, depth 10, `Poseidon2([l,r], 2)` internal nodes
- `sparse_merkle.ts` — fraud ASP sparse tree (Nethermind pattern)
- `nullifier.ts` — `computeNullifier`, `computeClaimHash`

### 2.2 ICD policy coverage tree

**Purpose:** Feed Circuit 1 (`policy_validity`) and `policy_registry.register_policy`.

1. Define seed data: ICD-10 coverage ranges (e.g. J00–J99 Respiratory, F01–F99 Mental health, C00–C97 Oncology) plus demo code **J18.9** (requirements Demo A).
2. For each covered ICD code `c`: `leaf = Poseidon2([icdToField(c)], 1)`.
3. Build depth-10 binary Merkle tree; pad to `2^10` leaves.
4. Output per-leaf: `{ icd_code, icd_code_field, leaf, index, merkle_path: Field[10] }`.
5. Store artifact used by `setup_asp.sh` / admin panel / client (e.g. `scripts/artifacts/policy_tree.json`).

**On-chain:** Insurer posts `coverage_merkle_root` via `policy_registry.register_policy`.

### 2.3 Doctor ASP membership tree

**Purpose:** Feed Circuit 3 (`doctor_attestation`) and `asp_membership` contract.

**Enrollment (admin / `setup_asp.sh`):**

- `enroll_doctor(license_hash, specialty_code, jurisdiction)` on `asp_membership`
- Leaf commitment: `Poseidon2([license_hash, specialty_code, jurisdiction_hash], 3)`
- Doctor receives `doctor_secret` (credential secret used in circuit private inputs)

**Circuit membership proof:**

- `leaf = Poseidon2([doctor_secret], 1)`
- Depth-10 Merkle path → `asp_merkle_root`

Seed at least one enrolled doctor for Demo A and one **unenrolled** wallet for Demo C.

Store artifact: `scripts/artifacts/asp_tree.json` with root, proofs, `doctor_commitment` per enrolled doctor.

### 2.4 Fraud ASP non-membership tree (sparse Merkle)

**Purpose:** Feed `asp_nonmembership` and claim escrow fraud check.

- Fork sparse Merkle pattern from Nethermind `asp_nonmembership`
- Leaf: `billing_pattern_hash = Poseidon2([icd_category_hash, amount_bucket_hash, provider_type_hash], 3)`
- Seed known fraud patterns (requirements Demo C)
- Output: `scripts/artifacts/fraud_tree.json` with root + non-membership proof format

**Claim escrow check:** Patient proves their claim's `billing_pattern_hash` is **NOT** in the fraud tree.

### 2.5 Nullifier registry design

**Formula (requirements §4.3):**

```
nullifier = Poseidon2([policy_id, visit_date, diagnosis_secret, random_nonce], 4)
```

- Computed client-side; passed in `ClaimPackage.nullifier` to `claim_escrow.submit_claim`
- `claim_escrow` stores spent nullifiers in persistent storage (`nullifier.rs`); rejects replay
- TTL on stale nullifiers per CAP-0078 (requirements §4.5)

**Not** wallet-based nullifiers. Double-claiming the same visit is cryptographically impossible.

### 2.6 Phase 2 exit criteria

- [ ] Policy tree root matches manual Merkle recomputation from any leaf proof
- [ ] ASP tree root matches `asp_membership.get_root()` after `setup_asp.sh`
- [ ] Fraud non-membership proof validates for a clean billing pattern
- [ ] Fraud pattern in blacklist fails non-membership proof
- [ ] Poseidon2 JS output matches Noir reference test vectors
- [ ] `manifest.json` records all three roots for Phase 4 deploy

---

## Phase 3 — Noir Circuits (requirements §8)

**Blocks on:** Phase 2  
**Key output:** Compiled ACIR + verification keys for all four circuits

Implement exactly as specified in requirements §8.2–§8.5. Summary:

### 3.1 Circuit 1: `policy_validity`

**Private:** `icd_code`, `icd_leaf_index`, `icd_merkle_path[10]`, `policy_secret`  
**Public:** `coverage_merkle_root`, `policy_commitment`, `claim_hash`

Constraints: ICD Merkle membership + `Poseidon2([icd_code, policy_secret], 2) == policy_commitment`

### 3.2 Circuit 2: `amount_range`

**Private:** `raw_amount`, `blinding_factor`, `policy_floor_cents`, `policy_ceiling_cents`  
**Public:** `amount_commitment` (Pedersen via `embedded_curve_ops` / `bn254_g1_mul`), `policy_bounds_hash`, `claim_hash`

Constraints: floor ≤ amount ≤ ceiling; Pedersen commit matches; bounds hash matches

### 3.3 Circuit 3: `doctor_attestation`

**Private:** `doctor_secret`, `doctor_leaf_index`, `asp_merkle_path[10]`, `claim_data_secret`  
**Public:** `asp_merkle_root`, `doctor_commitment`, `claim_hash`, `attestation_hash`

Constraints: ASP membership + commitment + `attestation_hash == Poseidon2([doctor_secret, claim_hash], 2)`

**No ECDSA/Schnorr in circuit** — attestation is hash-based per requirements.

### 3.4 Circuit 4: `deductible_accumulator` (P1 — moonshot)

**Private:** `prev_accumulator_secret`, `new_amount`, `new_amount_blinding`, `deductible_limit`  
**Public:** `prev_accumulator_commit`, `new_accumulator_commit`, `new_amount_commit`, `deductible_met`, `claim_hash`

Constraints: state transition + amount commitment chain to Circuit 2 + `deductible_met` boolean

### 3.5 Build & key generation (requirements §8.6)

```bash
cd circuits
nargo compile --workspace
nargo test --workspace

bb write_vk -b ./policy_validity/target/policy_validity.json -o ./policy_validity/target/vk
bb write_vk -b ./amount_range/target/amount_range.json -o ./amount_range/target/vk
bb write_vk -b ./doctor_attestation/target/doctor_attestation.json -o ./doctor_attestation/target/vk
bb write_vk -b ./deductible_accumulator/target/deductible_accumulator.json -o ./deductible_accumulator/target/vk

for circuit in policy_validity amount_range doctor_attestation deductible_accumulator; do
  bb compile_to_wasm -b ./$circuit/target/$circuit.json -o ../client/wasm/$circuit.wasm
done
```

### 3.6 Phase 3 exit criteria

- [ ] All four circuits pass `nargo test`
- [ ] Local `bb prove` / `bb verify` succeeds per circuit
- [ ] WASM artifacts land in `client/wasm/`

---

## Phase 4 — Soroban Smart Contracts (requirements §9)

**Blocks on:** Phases 2, 3  
**Key output:** Six deployed contracts on testnet

**Architecture:** Six separate contracts with cross-contract calls from `claim_escrow` — **not** a monolithic verifier.

### 4.1 `ultrahonk_verifier` (fork indextree)

- Multi-VK storage keyed by `circuit_id: u32` (0–3)
- `init(circuit_id, vk_bytes)` + `verify(circuit_id, public_inputs, proof) -> bool`
- Uses `bn254_multi_pairing_check` (P25), `bn254_msm` + scalar ops (P26)
- Files: `lib.rs`, `transcript.rs`, `arithmetic.rs`, `pairing.rs`, `msm.rs`

### 4.2 `asp_membership` (fork Nethermind)

- Poseidon2 Merkle tree of doctor credentials
- `enroll_doctor(license_hash, specialty_code, jurisdiction)`, `get_root()`, `get_path(index)`

### 4.3 `asp_nonmembership` (fork Nethermind sparse tree)

- Fraud billing pattern exclusion
- Non-membership proofs for `billing_pattern_hash`

### 4.4 `policy_registry` (new)

- `register_policy(insurer, coverage_root, bounds_hash, expiry_ledger)`
- `get_coverage_root(insurer)`

### 4.5 `claim_escrow` (orchestrator)

- `submit_claim(patient, ClaimPackage)` — central entry point
- `ClaimPackage`: four proofs + inputs, nullifier, insurer address, payout_amount
- Flow: nullifier check → verify 4 proofs via `ultrahonk_verifier` → ASP checks → policy lookup → deductible update → mark nullifier spent → USDC transfer
- Uses CAP-0082 checked arithmetic for payout logic
- Payout formula respects `deductible_met` from accumulator public inputs (Demo B)

### 4.6 `deductible_tracker`

- `get_accumulator(patient)`, `update_accumulator(patient, new_commitment, proof, public_inputs)`
- Uses `bn254_msm` for batched commitment verification (P26)

### 4.7 Deploy (requirements §9.8 — `scripts/deploy.sh`)

```bash
./scripts/deploy.sh testnet default
```

Deploy order: verifier → init VKs (circuit 0–3) → asp_membership → asp_nonmembership → policy_registry → deductible_tracker → claim_escrow (wire addresses).

Build target: `wasm32v1-none`.

### 4.8 Contract tests (requirements §12.1)

```bash
cargo test --workspace --features testutils
```

Required cases: valid proof, invalid proof, nullifier double-spend, ASP member check, fraud exclusion, deductible crossing, USDC settlement.

---

## Phase 5 — Client-Side Proof Engine (requirements §10)

**Blocks on:** Phase 3  
**Key output:** In-browser prover + transaction builder

### 5.1 Structure (`client/proof_gen/`)

```
client/proof_gen/
├── index.ts              # generateClaimProofs()
├── circuits.ts           # WASM loader
├── inputs.ts             # Types
├── workers/
│   ├── policy.worker.ts
│   ├── amount.worker.ts
│   ├── doctor.worker.ts
│   └── accum.worker.ts
└── stellar/
    ├── transaction.ts    # buildClaimTransaction()
    └── submit.ts
```

### 5.2 Orchestration

1. Compute `claim_hash = Poseidon2([visit_date, policy_id, nonce], 3)`
2. **Parallel:** policy, amount, doctor workers (~6–10s total)
3. **Sequential:** accumulator (needs `amount_commitment` from circuit 2)
4. Compute nullifier; build `ClaimPackage`

Libraries: `@noir-lang/noir_js`, `@aztec/bb.js`, WASM from `client/wasm/`.

### 5.3 Transaction builder (`client/stellar_tx/`)

Build `submit_claim` invocation on `claim_escrow` using `@stellar/stellar-sdk` Soroban RPC (requirements §10.4).

---

## Phase 6 — Frontend Application (requirements §11)

**Blocks on:** Phases 4, 5  
**Key output:** Patient, provider, and admin apps

**Stack:** React 18, TypeScript, Vite, Tailwind, Zustand, Freighter, OPFS (PoolStellar pattern).

### 6.1 `app/patient/`

- Onboarding: Freighter connect; generate policy secret + accumulator seed (OPFS)
- Claim inbox: "Claim ready — tap to submit"
- Proof progress: Policy (1/4) → Amount (2/4) → Doctor (3/4) → Deductible (4/4)
- Settlement receipt: nullifier as confirmation; no medical data
- Deductible status bar (derived from accumulator, no individual amounts)

### 6.2 `app/provider/`

- Freighter login (must be ASP-enrolled)
- New claim form: patient address, ICD-10, date, amount
- ECIES-encrypted claim token → QR / deep link; IPFS CID commitment
- History: `claim_hash` + date only

### 6.3 `app/admin/`

- Doctor ASP enrollment (`enroll_doctor`)
- Fraud pattern management (sparse tree updates)
- Policy registration (`policy_registry`)
- Escrow USDC balance + top-up

---

## Phase 7 — Test & Deployment Infrastructure (requirements §12)

### 7.1 Contract unit tests

See Phase 4.8.

### 7.2 Circuit tests

```bash
nargo test --workspace
# bb prove / bb verify per circuit (requirements §12.2)
```

### 7.3 E2E integration (`tests/e2e_claim_flow.ts`)

```bash
npm run test:e2e
```

Sequence (requirements §12.3):

1. Fund wallets via Friendbot
2. Enroll test doctor (`setup_asp.sh`)
3. Register policy in `policy_registry`
4. Simulate doctor claim token
5. Generate four WASM proofs
6. Submit Soroban transaction
7. Poll RPC (≤30s)
8. Assert USDC balance increase
9. Assert nullifier replay rejection
10. Assert no medical data in event logs

---

## Phase 8 — End-to-End Demo Flow (requirements §13)

**Target:** 4-minute hackathon demo.

| Time | Action |
|---|---|
| 0:00 | Three tabs: provider app, patient app, Stellar Explorer |
| 0:15 | Doctor: ICD J18.9, $1,200 → Sign & Send → QR |
| 0:45 | Patient: Submit Claim |
| 0:55 | Four-circuit proof progress bar |
| 1:40 | Freighter approval |
| 1:50 | Testnet tx submitted |
| 2:00 | Explorer: nullifier + Merkle root + USDC only |
| 2:20 | Patient: +$1,200 USDC |
| 2:40 | Demo B: deductible crossing ($800 + $400 → $1,000 threshold) |
| 3:15 | Demo C: unenrolled doctor + fraud pattern rejection |
| 3:45 | Claim history: nullifiers only |

Run via `scripts/demo_flow.sh`.

---

## Phase 9 — Selective Disclosure / View Keys (requirements §5, Innovation 5)

**Priority:** P2 (post-MVP)

- Patient encrypts claim blob with ECIES (insurer public key)
- IPFS CID committed on-chain
- Insurer / regulator selective reconstruction
- ZK proofs remain valid regardless of view key usage

---

## Build Order Summary

| Phase | Blocks on | Key output | Requirements ref | Priority |
|---|---|---|---|---|
| 1 — Toolchain & skeleton | — | Dev env ready | §7.1, §8.1, §9.1 | P0 |
| 2 — Merkle / ASP data | 1 | Tree roots + proofs | §4.3, §8, §9.3–9.4 | P0 |
| 3 — Noir circuits | 2 | ACIR + VKs + WASM | §8 | P0/P1 |
| 4 — Soroban contracts | 2, 3 | 6 deployed contracts | §9 | P0 |
| 5 — Client prover | 3 | Browser proof engine | §10 | P0 |
| 6 — Frontend apps | 4, 5 | patient / provider / admin | §11 | P1/P2 |
| 7 — Tests & deploy scripts | 4, 5 | E2E passing | §12 | P1 |
| 8 — Demo | 6, 7 | 4-min demo | §13 | P1 |
| 9 — View keys | 6 | Selective disclosure | §5 | P2 |

**Critical path:** 2 → 3 → 4 → 5 → 6 → 7 → 8

---

## Component Priority (requirements §14.5)

| Component | Priority |
|---|---|
| policy_validity, amount_range, doctor_attestation circuits | P0 |
| deductible_accumulator circuit | P1 |
| ultrahonk_verifier, asp_membership, asp_nonmembership, policy_registry, claim_escrow | P0 |
| deductible_tracker | P1 |
| client/proof_gen, client/stellar_tx | P0 |
| app/patient, app/provider | P1 |
| app/admin | P2 |
| scripts/deploy.sh, setup_asp.sh, demo_flow.sh | P0 |
| tests/e2e_claim_flow.ts | P1 |

---

## External References (requirements §14)

- [Stellar ZK docs](https://developers.stellar.org/docs/build/apps/zk)
- [Stellar Privacy docs](https://developers.stellar.org/docs/build/apps/privacy)
- [Noir docs](https://noir-lang.org/docs/)
- [Barretenberg](https://github.com/AztecProtocol/aztec-packages)
- [Privacy Pools whitepaper](https://privacypools.com/whitepaper.pdf)
- CAP-0074, CAP-0075, CAP-0080, CAP-0082, CAP-0078 (see requirements §14.1)

---

*This plan mirrors [requirements.md](./requirements.md) v1.0 · June 2026 · ZK on Stellar Hackathon.*
