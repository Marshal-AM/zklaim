# Health Passport — implementation status

Last updated: 2026-06-27

## Overview

Health Passport extends ZKlaim after claim settlement: patients optionally append Poseidon Merkle leaves to `passport_registry`, store private leaf metadata in OPFS, and generate **category non-membership** credentials for registered verifiers.

## What you need (not in repo / ops)

| Requirement | Notes |
|-------------|--------|
| Redeploy contracts | `passport_registry` is new; `claim_escrow` emits `passport_leaf_ready` event |
| Rebuild circuits | `category_nonmembership` is circuit id **4** |
| `.env` | Set `VITE_PASSPORT_REGISTRY_CONTRACT_ID` after deploy |
| VK init | `deploy.sh` initializes VKs 0–4 on `ultrahonk_verifier` |
| Admin step | Register verifier addresses via Admin → Passport → Verifier registry |

```bash
# Full toolchain (after nargo + bb installed)
bash scripts/build_circuits.sh   # includes category_nonmembership
bash scripts/deploy.sh testnet zklaim-deploy
# Add VITE_PASSPORT_REGISTRY_CONTRACT_ID from .env to app env
```

## Built — contracts

| Component | Path | Status | Tested |
|-----------|------|--------|--------|
| `passport_registry` | `contracts/passport_registry/` | Done | `cargo test -p passport_registry` (2 tests) |
| `append_leaf` | cross-calls `claim_escrow.nullifier_spent` | Done | Unit test |
| `get_root` / `get_leaf_count` / `get_merkle_path` | per-patient depth-8 tree | Done | Unit test |
| `register_verifier` / `is_verifier_registered` | admin whitelist | Done | Unit test |
| `verify_credential` / `is_credential_valid` | UltraHonk via verifier contract | Done | Not e2e on testnet |
| `claim_escrow` event | `(passport, leaf_rdy)` after settlement | Done | Not e2e |
| Circuit id 4 | `contracts/common/src/circuit_ids.rs` | Done | Compile |

## Built — ZK

| Component | Path | Status | Tested |
|-----------|------|--------|--------|
| `category_nonmembership` | `circuits/category_nonmembership/` | Done | `nargo compile --workspace` |
| Depth-8 Merkle helper | `circuits/common/src/lib.nr` | Done | Compile |
| `proveCategoryNonMembershipCircuit` | `client/proof_gen/circuits.ts` | Done | Needs `client/wasm/category_nonmembership.json` from `build_circuits.sh` |
| Worker | `client/proof_gen/workers/category.worker.ts` | Done | Not run in CI without wasm |

**Leaf hash (canonical):** `Poseidon2(nullifier, leaf_secret, icd_letter, amount_bucket, visit_month)` — 5 fields, depth-8 tree.

## Built — client / app

| Component | Path | Status | Tested |
|-----------|------|--------|--------|
| Leaf helpers | `app/src/lib/passport.ts` | Done | `app/src/lib/passport.test.ts` (4 tests) |
| OPFS store | `app/src/lib/passportStore.ts` | Done | Manual / integration |
| Append flow | `app/src/lib/passportAppend.ts` | Done | Requires deployed contract |
| Contract RPC | `app/src/lib/passportContract.ts` | Done | Requires deployed contract |
| Credential prove | `app/src/lib/passportCredential.ts` | Done | Requires wasm + chain |
| Settlement → passport CTA | `app/src/patient/SubmitClaimFlow.tsx` | Done | Manual |
| Passport tab + pages | `PatientPassportPage`, history, share | Done | Manual |
| Admin verifier UI | `app/src/admin/VerifierRegistry.tsx` | Done | Requires contract |

## Built — deploy scripts

| Script | Change |
|--------|--------|
| `scripts/deploy.sh` | Deploy + init `passport_registry`; VK 0–4; env vars |
| `scripts/build_circuits.sh` | Includes `category_nonmembership` artifact copy |
| `scripts/test_circuits.sh` | Includes `category_nonmembership` bb prove |

## Not built (deferred per feasibility)

| Feature | Reason |
|---------|--------|
| `active_coverage` credential | Needs policy circuit changes / full ICD — not passport leaf |
| `coverage_continuity` credential | Needs new circuit — accumulator reuse insufficient |
| `deductible_status` as ZK credential | UI shows deductible bar; on-chain read only |
| AES-GCM from Stellar private key | Freighter has no private key — uses plain OPFS JSON like rest of app |
| NFC share | Web NFC not implemented |
| Multi-category in one proof | One `excluded_category` per proof — UI loops categories |

## End-to-end test checklist (manual)

1. [ ] `bash scripts/build_circuits.sh` — `client/wasm/category_nonmembership.json` exists
2. [ ] `bash scripts/deploy.sh` — `PASSPORT_REGISTRY_CONTRACT_ID` in `.env`
3. [ ] Set `VITE_PASSPORT_REGISTRY_CONTRACT_ID` in `.env`, restart dev server
4. [ ] Patient: submit claim → receipt → **Add to Passport** → success tx
5. [ ] Passport tab shows leaf count + categories
6. [ ] Admin: register verifier address
7. [ ] Passport → Share credential → generate (proves ~8s) → on-chain tx
8. [ ] Verifier reads `is_credential_valid` (RPC simulate)

## Test commands run in this implementation

```bash
cargo test -p passport_registry          # PASS (2 tests)
cd circuits && nargo compile --workspace   # PASS (category_nonmembership)
cd app && npm test                         # PASS (37 tests, includes passport.test.ts)
```
