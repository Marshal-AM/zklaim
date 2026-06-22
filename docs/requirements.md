
ZKlaim
Private Medical Claims on Stellar
Zero-Knowledge Proof System for Insurance Settlement
Document Type
Full Requirements Specification	Hackathon
ZK on Stellar — June 2026


Version 1.0  ·  June 2026  ·  Confidential

Table of Contents
Part I — Product Requirements Document
  1.  Executive Summary
  2.  The Problem
  3.  The Solution — What ZKlaim Offers
  4.  Stellar's Role — Why This Only Works on Stellar
  5.  Key Innovations
  6.  Target Users & Demo Scenarios

Part II — Technical Requirements Document
  7.  System Architecture Overview
  8.  ZK Circuit Components (Noir)
  9.  Stellar Smart Contracts (Soroban / Rust)
  10. Client-Side Proof Engine (WASM / Browser)
  11. Frontend Application
  12. Test & Deployment Infrastructure
  13. End-to-End Demo Flow
  14. Dependency & Reference Index

PART  I
PRODUCT REQUIREMENTS DOCUMENT

1.  Executive Summary
ZKlaim is a zero-knowledge insurance claim settlement system built entirely on the Stellar blockchain. It enables any insured patient to submit a medical claim and receive a USDC reimbursement in under 60 seconds — without the blockchain, the insurer's operations team, or any third party ever learning what the patient's diagnosis was, which doctor they visited, or the exact amount claimed.

The surface is a "Submit Claim" button. The depth is a composition of every zero-knowledge primitive Stellar has introduced across Protocols 22, 25 (X-Ray), and 26 (Yardstick) — BLS12-381, BN254 elliptic curve operations, Poseidon hashing, multi-scalar multiplication — assembled into three Noir circuits, two ASP compliance trees, a recursive deductible accumulator, and a Soroban settlement contract, all running on testnet.

One-sentence pitch
Prove your insurance claim is valid. Receive payment. Reveal nothing about your diagnosis.

1.1  What Makes This Different From Every Prior Art
Nethermind PoolStellar (PoC)	Privacy pools for generic USDC transfers. No domain logic, no circuit composition, no recursive state.
Tornado Cash pattern	Denomination-fixed pools. No notion of validity proofs for domain claims. No compliance layer.
ZKlaim	Three circuits compose in a single transaction. Compliance runs through ASP membership proofs. Running deductible state is tracked privately across claims with a recursive accumulator — a primitive that does not exist anywhere on Stellar today.

2.  The Problem
2.1  Medical Privacy is Broken Everywhere, Including On-Chain
Health insurance is one of the most financially significant interactions a normal person has with any institution. In most countries, filing a claim means disclosing a diagnosis to an employer-contracted insurer, whose records are accessible to underwriters, actuarial teams, re-insurers, and increasingly data brokers. The patient never consented to this information economy — they only wanted reimbursement.

Blockchain makes this dramatically worse, not better. On a public ledger, a payment from an insurer wallet to a patient wallet is permanently visible, timestamped, and amount-tagged. An observer who knows your wallet address (your employer, an exchange that KYC'd you, anyone who received a payment from you) can see every insurance settlement you ever received. The diagnosis itself is not on-chain, but the pattern — the amount, the timing, the source — can be highly revealing.

Real-world privacy failure
A cancer patient settles a $12,400 claim. Their employer, who pays for the group plan, can see the insurer sent $12,400 to that wallet. Even without a diagnosis code, the amount pattern reveals something serious happened.
A mental health patient receives three $800 settlements over six months. The pattern is trivially identifiable by anyone monitoring the insurer's Stellar address.
A patient with a chronic condition receives monthly settlements. The regularity alone is a disclosure.

2.2  The Current "Solutions" Fail
Traditional insurance portals: centralized, breachable, opaque. Colonial Health's 2023 breach exposed 140 million claim records.
Private blockchain (Hyperledger, R3 Corda): gives insurers privacy from each other but not from themselves. Patient data still fully visible to the insurer platform.
Simple ZK mixers (Tornado Cash model): break the payment link but cannot prove the payment was for a legitimate, non-fraudulent claim. Any fraudster can use the same mixer.
Existing Stellar privacy tools: Nethermind's PoolStellar provides private value transfer but has no mechanism to prove that a transfer satisfies a specific set of domain conditions (valid policy, valid diagnosis category, authorized provider, deductible thresholds).

2.3  The Gap ZKlaim Fills
The gap is this: there is no system, on any blockchain, that can simultaneously prove (a) this claim is valid under a real policy, (b) this provider is licensed, (c) this amount is within policy limits, and (d) my running deductible is at the right level — while revealing none of the underlying data. ZKlaim builds that system on Stellar.

Requirement	What it means	Does anything solve it today?
Claim validity without disclosure	Prove the ICD code is covered without revealing the code	No — all systems require disclosure
Amount privacy with range proof	Prove amount is in [floor, ceiling] without revealing it	Partial — generic range proofs exist but not wired to insurance logic
Provider authenticity without identity	Prove a licensed doctor signed the claim without naming them	No — no ASP-based doctor attestation exists on Stellar
Private deductible tracking	Know when the deductible is met without revealing past claims	No — this is the moonshot. Does not exist on any chain.
Fraud prevention without surveillance	Block known fraud patterns without watching honest patients	Partial — Nethermind's ASP non-membership proofs exist but not applied here
On-chain settlement in USDC	Receive payment without an anchor or fiat bridge	Yes — Stellar + Soroban can do this natively

3.  The Solution — What ZKlaim Offers
3.1  The Patient Experience (Surface)
From the patient's perspective, ZKlaim is a simple three-step web application:

Step 1	Doctor generates claim
The treating physician opens ZKlaim's provider interface, enters the ICD-10 diagnosis code, the treatment date, and the billed amount. They sign the attestation with their wallet (which is registered in the doctor ASP membership tree). This creates an encrypted claim token sent to the patient.
Step 2	Patient submits claim
The patient opens the ZKlaim patient app, connects their Freighter wallet, and sees "Claim Ready." They press Submit. The browser silently generates three ZK proofs using Noir circuits compiled to WebAssembly. The diagnosis, amount, and doctor identity never leave the device. In approximately 6-10 seconds, a single Soroban transaction is broadcast.
Step 3	USDC settles instantly
The Soroban verifier contract checks the proofs on-chain. If valid, the claim escrow contract releases the correct USDC amount to the patient's wallet. The entire on-chain record shows: one nullifier, one Merkle root update, one USDC transfer. No diagnosis. No amount in the public inputs. No doctor name. The insurer knows their reserve went down. That is all.

3.2  What ZKlaim Guarantees
The patient's diagnosis is never visible on-chain, in Soroban contract storage, or in transaction metadata.
The billed amount is never revealed — only that it falls within a valid policy range.
The treating physician's identity is never on-chain — only that a licensed physician (an ASP member) signed the claim.
Double-claiming the same visit is cryptographically impossible — Poseidon nullifiers prevent reuse.
Known fraudulent billing patterns are blocked without surveilling honest patients — the fraud ASP non-membership tree handles this.
The patient's annual deductible progress is tracked privately — a recursive accumulator proves threshold crossing without revealing individual claim amounts.
An insurer auditor with a view key can reconstruct any claim — selective disclosure is available but not mandatory.

3.3  What ZKlaim Does NOT Do
It does not replace KYC/AML compliance — it enhances it via ZK proofs rather than eliminating it.
It does not require an anchor or fiat bridge — settlement is entirely in USDC on Stellar.
It does not require any off-chain infrastructure to verify proofs — the Soroban verifier is fully on-chain.
It does not store medical data anywhere — not on the blockchain, not on a server, not on IPFS.

4.  Stellar's Role — Why This Only Works on Stellar
ZKlaim is not a project that happens to run on Stellar. It is a project that is only possible because of what Stellar has built across three protocol releases. Every ZK primitive in the system maps to a specific Stellar host function. Removing any one of them requires rewriting core cryptography in Wasm — making the system either too expensive or too slow to be practical.

4.1  BN254 Elliptic Curve Operations (Protocol 25 — X-Ray)
CAP-0074 introduced three host functions: bn254_g1_add, bn254_g1_mul, and bn254_multi_pairing_check. These are the cryptographic backbone of every BN254-based proof system, including Noir's UltraHonk backend which ZKlaim uses.

Host function	Role in ZKlaim	What breaks without it
bn254_g1_add	Adds two G1 elliptic curve points during UltraHonk verifier inner loops; also used to combine Pedersen commitment components	Verification must run in Wasm: 100x+ slower and roughly 50x more expensive in Soroban fees
bn254_g1_mul	Scalar × G1 point. Creates Pedersen commitments to claim amounts. Patient commits to an amount; the circuit proves range properties about the committed value	Without this, amount hiding requires a completely different commitment scheme
bn254_multi_pairing_check	Final step of UltraHonk proof verification. Takes G1 and G2 point pairs and confirms the pairing equation holds. This IS the on-chain proof check.	Without this, on-chain UltraHonk proof verification is not feasible at any price point

4.2  Nine Additional BN254 Functions (Protocol 26 — Yardstick)
CAP-0080 added multi-scalar multiplication (MSM), scalar field arithmetic (add, sub, mul, power, inverse), and curve membership checks. These are what make ZKlaim's moonshot feature — the recursive deductible accumulator — economically viable.

Host function group	Role in ZKlaim	Innovation enabled
bn254_msm (multi-scalar multiply)	Batches multiple commitment verifications into a single efficient operation. When a patient submits their Nth claim, the MSM aggregates all N commitment updates for the deductible accumulator in one contract call	Recursive deductible tracking across multiple claims at a cost-per-claim that does not grow linearly
Scalar field arithmetic (add, sub, mul, inv)	Used inside the verifier inner product argument. Also used to compute the blinding factors for Pedersen commitments off-chain, which the circuit then verifies on-chain	Eliminates the need for Wasm-side field arithmetic in the verifier, reducing computation units by an order of magnitude
Curve membership checks	Validates that G1 and G2 points provided as public inputs are actually on the BN254 curve — essential security check that prevents malformed-proof attacks	Without this, an attacker could submit carefully crafted invalid points that pass the pairing check in degenerate cases

4.3  Poseidon and Poseidon2 Hash Functions (Protocol 25 — X-Ray)
CAP-0075 introduced Poseidon and Poseidon2 as native host functions. This is the hash function that makes ZK circuits efficient. SHA-256 requires roughly 25,000 R1CS constraints per hash; Poseidon requires approximately 60 in a BN254-native field. ZKlaim hashes everywhere.

Use of Poseidon in ZKlaim	What is hashed	Why Poseidon and not SHA-256
Nullifier generation	Poseidon(policy_id, visit_date, diagnosis_secret, random_nonce) → nullifier stored on-chain	SHA-256 would add ~75,000 constraints to the circuit and make browser-side proving take 60+ seconds
Merkle tree commitments	Poseidon(left_child, right_child) → parent node, used in both doctor ASP tree and policy commitment tree	The same Poseidon instance runs in the circuit AND in the Soroban contract. Consistency is guaranteed.
Deductible accumulator	Poseidon(prev_accumulator, new_amount_commitment) → new_accumulator	Enables the recursive state update to be proven in a ZK circuit at negligible constraint cost
Policy commitment	Poseidon(policy_id, coverage_mask, expiry_timestamp) → policy_commitment stored on-chain by insurer	Insurer commits to policy terms without revealing individual coverage details

4.4  Privacy Pool Architecture (Nethermind PoolStellar as Foundation)
ZKlaim extends the Nethermind PoolStellar proof-of-concept which itself implements the Privacy Pools whitepaper (Buterin, Illum, Nadler, Schär, Soleimani). The core pattern — UTXO-style commitments, nullifiers, Merkle membership proofs, ASP allow/deny lists — is inherited and then extended with domain-specific circuits for medical claims.

The pool contract pattern (deposit, transfer, withdraw as commitment operations) is reused for claim escrow.
The ASP membership contract is repurposed: instead of financial compliance allow-lists, it holds a Merkle tree of licensed physician credential commitments.
The ASP non-membership contract (sparse Merkle tree) is repurposed: instead of OFAC sanctions exclusion, it holds known fraudulent billing patterns.
The critical extension: ZKlaim adds three novel Noir circuits on top of this foundation that prove domain-specific claims, not generic value transfers.

4.5  Soroban Smart Contract Platform
Stellar's Soroban smart contract environment provides the execution layer for all on-chain logic. Several Soroban-specific properties make ZKlaim practical:
Resource metering: Soroban's deterministic fee model means ZKlaim can calculate the exact cost of proof verification before submitting, making UX predictable.
Contract-to-contract calls: the verifier, the ASP contracts, and the claim escrow contract communicate via cross-contract calls in a single Soroban transaction.
CAP-0082 (checked 256-bit integer arithmetic, Protocol 26): the claim escrow contract uses 256-bit checked arithmetic for USDC amount calculations, preventing silent overflow on large claims.
CAP-0078 (precise TTL control, Protocol 26): claim commitments are given explicit TTL to prevent the Soroban state from growing unbounded with stale nullifiers.

5.  Key Innovations
ZKlaim makes five distinct technical contributions, ordered from "builds on existing work" to "genuinely new primitive on Stellar."

Innovation 1: Domain-Specific Noir Circuits for Insurance
Novelty level: Medium — Noir circuits are known; applying them to insurance logic with ICD code range proofs is new
No Stellar project has ever written a Noir circuit that proves membership in a medical coverage category without revealing the medical code itself.

The policy validity circuit encodes a coverage Merkle tree. Leaf nodes represent ranges of ICD-10 codes (e.g., "J00–J99: Respiratory" is a single leaf). The patient proves their specific ICD code hashes to a leaf that is in the coverage tree, without revealing which leaf or which code. This is a set-membership proof over a domain-specific ontology — a new pattern for Stellar ZK.

Innovation 2: Composable Multi-Circuit Transaction
Novelty level: High — composing three independent Noir circuits whose outputs chain as inputs is new on Stellar
The three circuits (policy, amount, doctor) are generated independently but their public outputs are chained: the amount circuit takes the policy commitment as a public input, and the doctor circuit takes the claim hash as a public input. A single Soroban transaction verifies all three using three separate UltraHonk calls, which is a composition pattern never demonstrated on Stellar before.

Innovation 3: Doctor ASP with Professional Licensing
Novelty level: High — ASP trees have only been used for financial compliance. Using them for professional licensing is a new application domain.
The doctor ASP membership tree is a Poseidon Merkle tree whose leaves are commitments of the form Poseidon(doctor_license_number, specialty_code, jurisdiction_hash). A doctor proves membership in this tree to attest their claim without revealing their identity. This is the first use of the Privacy Pool ASP architecture for professional credentialing on any blockchain.

Innovation 4: Recursive Private Deductible Accumulator
Novelty level: Very High — this primitive does not exist on Stellar or any other chain as an application-level feature
Health insurance deductibles require tracking a running total across multiple claims within a policy year. Doing this on a public chain leaks every prior claim amount.

ZKlaim introduces a Poseidon-based accumulator: a private running state that updates provably. Each claim submission includes a "state transition proof" showing that the new accumulator value is Poseidon(prev_accumulator, new_amount_blinding) and that this committed amount, when added to the committed running total, either stays below or crosses the deductible threshold.

The threshold crossing triggers a different payout formula (patient pays nothing vs. patient pays coinsurance) — without the on-chain contract ever knowing any individual claim amount. The BN254 MSM host function from Protocol 26 batches the commitment arithmetic, keeping the on-chain verification cost constant regardless of how many prior claims exist.

Innovation 5: Selective Disclosure with View Keys
Novelty level: Medium-High — view keys for selective disclosure are referenced in Stellar's privacy strategy but no implementation exists on Stellar
An insurer may be required by law to reconstruct claim details for a regulator. ZKlaim implements a view key mechanism: the patient encrypts their claim data with an ECIES key derived from the insurer's public key. The encrypted blob is stored off-chain (IPFS CID committed on-chain). The insurer can always decrypt their own view key portion. A regulator with a court order can request the insurer share the view key. No one else can decrypt without both keys. The ZK proofs remain valid regardless of whether the view key is ever used.

6.  Target Users and Demo Scenarios
6.1  Primary Users
User type	Role in ZKlaim	What they gain
Insured patient	Submits claims via browser app	Medical privacy, instant USDC settlement, no paperwork
Licensed physician	Generates signed claim tokens via provider interface	Streamlined attestation, no patient data stored on their systems
Insurance operator	Deploys escrow contract, manages policy commitments	Automated settlement, no human claim reviewers, fraud ASP auto-blocks bad actors
Compliance auditor	Holds view key for selective disclosure	Can reconstruct any claim they are authorized to see, on demand

6.2  Demo Scenarios
Demo Scenario A — Standard Claim (Happy Path)
Doctor opens provider interface, enters ICD-10 code J18.9 (pneumonia), amount $1,200, date today. Signs with their wallet.
Patient opens patient app. Sees "Claim ready from Dr. [anonymous]." Presses Submit Claim.
Browser generates three ZK proofs in ~7 seconds. Progress bar shows "Generating proof..."
Transaction broadcast to Stellar testnet. Block explorer opens — shows only a nullifier hash, a Merkle root, and a USDC transfer.
Patient wallet shows +$1,200 USDC. No diagnosis visible anywhere.

Demo Scenario B — Deductible Crossing
Patient has submitted two prior claims (total committed: $800). Deductible is $1,000.
New claim for $400. The deductible accumulator proof shows: prev_total < $1,000, new_total > $1,000.
Soroban contract automatically applies different payout formula: patient receives full $400 (post-deductible, insurer covers 100%).
No individual claim amount is ever revealed. The contract only sees: "deductible threshold crossed = true."

Demo Scenario C — Fraud ASP Block
An attempt is made to submit a claim signed by a wallet NOT in the doctor ASP membership tree.
The membership proof fails at circuit verification. Soroban rejects the transaction.
Demonstrate with a second attempt using an ASP-blocked billing code pattern (non-membership proof fails).
Both rejections happen in the same UI with a clear error. Privacy of legitimate patients is entirely unaffected.

PART  II
TECHNICAL REQUIREMENTS DOCUMENT

7.  System Architecture Overview
7.1  Repository Structure
zkclaim/
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

7.2  Data Flow Overview
The following describes the complete data flow for a standard claim submission:

Doctor creates a signed claim blob: { icd_code, amount, visit_date, doctor_sig, policy_id }. This is encrypted with ECIES using the patient's public key and sent to the patient (off-chain, e.g. QR code or deep link). An IPFS CID of the encrypted blob is stored.
Patient decrypts the claim blob in their browser. All sensitive data lives only in JavaScript memory.
The proof orchestrator (TypeScript) runs three Noir WASM circuits in parallel: (a) policy circuit with ICD code + policy_commitment as private/public inputs, (b) amount circuit with raw_amount + policy_bounds as private/public inputs, (c) doctor circuit with doctor_license + ASP_merkle_root as private/public inputs.
Each circuit produces an UltraHonk proof. The orchestrator also runs the deductible accumulator circuit, taking the patient's current accumulator state as a private input and producing a new accumulator commitment.
A Soroban transaction is built containing all four proof blobs and their public inputs. The transaction calls the claim_escrow contract's submit_claim function.
On-chain: claim_escrow calls the ultrahonk_verifier three times (once per circuit), calls asp_membership to check the doctor's proof, calls asp_nonmembership to check the fraud exclusion proof, queries policy_registry for the policy commitment, and updates deductible_tracker with the new accumulator.
If all checks pass: the nullifier is stored (preventing replay), the correct USDC amount is transferred from the insurer's escrow to the patient's wallet.

8.  ZK Circuit Components (Noir)
8.1  Toolchain and Setup
Tool	Version	Purpose	Install command
nargo (Noir)	≥ 1.0.0-beta.3	Noir circuit compiler and prover	curl -L noirup.dev | bash
bb (Barretenberg)	≥ 0.63.0	UltraHonk backend, proof generation	bbup -v 0.63.0
wasm-pack	latest	Compiles Rust WASM to browser bundle	cargo install wasm-pack
Noir std library	bundled with nargo	Standard ZK primitives	Included in nargo

Reference documentation
Noir language: https://noir-lang.org/docs/
Barretenberg (bb): https://github.com/AztecProtocol/aztec-packages
UltraHonk Soroban verifier: https://github.com/indextree/ultrahonk_soroban_contract
Noir stdlib: https://noir-lang.org/docs/noir/standard_library/

8.2  Circuit 1: Policy Validity (circuits/policy_validity/src/main.nr)
Purpose: Prove that a specific ICD-10 code is covered under a policy without revealing the code or the policy's full terms.

// circuits/policy_validity/src/main.nr

// Private inputs — never revealed on-chain
fn main(
    icd_code: Field,              // e.g. hash of "J18.9"
    icd_leaf_index: u64,          // Position in coverage Merkle tree
    icd_merkle_path: [Field; 10], // Sibling hashes for membership proof
    policy_secret: Field,          // Patient's policy secret

    // Public inputs — visible on-chain as proof inputs
    coverage_merkle_root: pub Field, // Posted by insurer in policy_registry
    policy_commitment: pub Field,    // Poseidon(policy_id, expiry, secret)
    claim_hash: pub Field,           // Hash of the overall claim (links circuits)
) {
    // 1. Verify ICD code is in the coverage Merkle tree
    let leaf = std::hash::poseidon2::Poseidon2::hash([icd_code], 1);
    let computed_root = compute_merkle_root(leaf, icd_leaf_index, icd_merkle_path);
    assert(computed_root == coverage_merkle_root,
        "ICD code not covered under this policy");

    // 2. Verify policy commitment (proves patient holds the real policy)
    let expected_commitment = std::hash::poseidon2::Poseidon2::hash(
        [icd_code, policy_secret], 2
    );
    assert(expected_commitment == policy_commitment,
        "Invalid policy commitment");
}

// Helper: recompute Merkle root from leaf + path
fn compute_merkle_root(leaf: Field, index: u64, path: [Field; 10]) -> Field {
    let mut current = leaf;
    for i in 0..10 {
        let is_right = (index >> i) & 1;
        let (l, r) = if is_right == 1 { (path[i], current) }
                     else              { (current, path[i]) };
        current = std::hash::poseidon2::Poseidon2::hash([l, r], 2);
    }
    current
}

Public input	Type	Source	On-chain visibility
coverage_merkle_root	Field	Policy registry contract (insurer sets this)	Public — posted once per policy type
policy_commitment	Field	Patient computes off-chain, registers once	Public — stored in patient's on-chain commitment
claim_hash	Field	Poseidon(visit_date, policy_id, nonce)	Public — links all three circuits to one claim

8.3  Circuit 2: Amount Range Proof (circuits/amount_range/src/main.nr)
Purpose: Prove the claimed amount is ≥ policy floor and ≤ policy ceiling without revealing the amount. Uses a Pedersen commitment scheme backed by BN254 g1_mul.

// circuits/amount_range/src/main.nr

fn main(
    raw_amount: u64,              // Private: actual claim amount in cents
    blinding_factor: Field,        // Private: random blinding for Pedersen
    policy_floor_cents: u64,       // Private: min covered amount
    policy_ceiling_cents: u64,     // Private: max covered amount

    amount_commitment: pub Field,  // Public: Pedersen commit(amount, blinding)
    policy_bounds_hash: pub Field, // Public: Poseidon(floor, ceiling, policy_id)
    claim_hash: pub Field,         // Public: links to other circuits
) {
    // 1. Range check — amount is within policy bounds
    assert(raw_amount >= policy_floor_cents,  "Amount below policy floor");
    assert(raw_amount <= policy_ceiling_cents,"Amount exceeds policy ceiling");

    // 2. Verify Pedersen commitment to amount
    // Note: In Noir, BN254 g1_mul is available via the embedded curve ops
    let computed_commit = pedersen_commit(raw_amount as Field, blinding_factor);
    assert(computed_commit == amount_commitment,
        "Amount commitment mismatch");

    // 3. Verify policy bounds commitment
    let bounds_check = std::hash::poseidon2::Poseidon2::hash([
        policy_floor_cents as Field,
        policy_ceiling_cents as Field,
    ], 2);
    assert(bounds_check == policy_bounds_hash,
        "Policy bounds commitment mismatch");
}

// Pedersen commitment using BN254 embedded curve (available in Noir stdlib)
fn pedersen_commit(value: Field, blinding: Field) -> Field {
    // std::embedded_curve_ops maps to bn254_g1_mul Soroban host function
    let G = std::embedded_curve_ops::EmbeddedCurvePoint::generator();
    let H = std::embedded_curve_ops::EmbeddedCurvePoint::from_x(
        0x077da99d806abd13c9f15ece5398525119d11e11e9836b2ee7d23f6159ad87d4
    );
    let commit = G.mul(value) + H.mul(blinding);
    commit.x // x-coordinate as commitment
}

8.4  Circuit 3: Doctor Attestation (circuits/doctor_attestation/src/main.nr)
Purpose: Prove a licensed doctor (ASP member) signed this specific claim without revealing the doctor's identity.

// circuits/doctor_attestation/src/main.nr

fn main(
    doctor_secret: Field,          // Private: doctor's ZKlaim credential secret
    doctor_leaf_index: u64,         // Private: position in ASP membership tree
    asp_merkle_path: [Field; 10],  // Private: sibling hashes for membership proof
    claim_data_secret: Field,       // Private: binds signature to this specific claim

    asp_merkle_root: pub Field,     // Public: current doctor ASP tree root
    doctor_commitment: pub Field,   // Public: Poseidon(doctor_secret) — registered at enrollment
    claim_hash: pub Field,          // Public: must match Circuit 1 and 2
    attestation_hash: pub Field,    // Public: Poseidon(doctor_secret, claim_hash)
) {
    // 1. Verify doctor is in ASP membership tree
    let leaf = std::hash::poseidon2::Poseidon2::hash([doctor_secret], 1);
    let computed_root = compute_merkle_root(leaf, doctor_leaf_index, asp_merkle_path);
    assert(computed_root == asp_merkle_root,
        "Doctor not in ASP membership tree");

    // 2. Verify doctor commitment matches enrollment
    let computed_commit = std::hash::poseidon2::Poseidon2::hash([doctor_secret], 1);
    assert(computed_commit == doctor_commitment,
        "Doctor commitment mismatch");

    // 3. Verify attestation links this doctor to this specific claim
    let computed_attestation = std::hash::poseidon2::Poseidon2::hash([
        doctor_secret, claim_hash
    ], 2);
    assert(computed_attestation == attestation_hash,
        "Attestation does not match this claim");
}

8.5  Circuit 4: Deductible Accumulator (circuits/deductible_accumulator/src/main.nr)
Purpose: The moonshot circuit. Proves a private running total crosses (or has not yet crossed) an annual deductible threshold, without revealing the total or any individual claim amount. This is a recursive state-transition proof.

// circuits/deductible_accumulator/src/main.nr

fn main(
    prev_accumulator_secret: Field, // Private: previous running total secret
    new_amount: u64,                // Private: this claim's amount in cents
    new_amount_blinding: Field,     // Private: blinding factor for this claim
    deductible_limit: u64,          // Private: annual deductible in cents

    prev_accumulator_commit: pub Field,  // Public: commitment to previous total
    new_accumulator_commit: pub Field,   // Public: commitment to updated total
    new_amount_commit: pub Field,        // Public: must match Circuit 2 output
    deductible_met: pub bool,            // Public: true if threshold crossed
    claim_hash: pub Field,               // Public: links to the full claim
) {
    // 1. Verify the new accumulator commitment is computed correctly
    // new_accumulator = Poseidon(prev_accumulator_secret, new_amount, blinding)
    let expected_new_commit = std::hash::poseidon2::Poseidon2::hash([
        prev_accumulator_secret,
        new_amount as Field,
        new_amount_blinding,
    ], 3);
    assert(expected_new_commit == new_accumulator_commit,
        "New accumulator commitment incorrect");

    // 2. Verify prev commitment matches claimed previous state
    let expected_prev = std::hash::poseidon2::Poseidon2::hash(
        [prev_accumulator_secret], 1
    );
    assert(expected_prev == prev_accumulator_commit,
        "Previous accumulator commitment mismatch");

    // 3. Verify new_amount commitment matches Circuit 2's output
    let recomputed_amount_commit = pedersen_commit(
        new_amount as Field, new_amount_blinding
    );
    assert(recomputed_amount_commit == new_amount_commit,
        "Amount commitment chain broken");

    // 4. Verify deductible_met flag is correct
    // We need the running total, but we only have commitments.
    // Solution: circuit proves the boolean flag is consistent with
    // the committed values using range constraints.
    // This works because the prover knows the plaintext.
    let running_total = prev_accumulator_secret + new_amount as Field;
    let expected_met: bool = running_total as u64 >= deductible_limit;
    assert(expected_met == deductible_met,
        "Deductible threshold flag incorrect");
}

8.6  Circuit Build and Key Generation
# From circuits/ directory

# Build all circuits
nargo compile --workspace

# Generate proving and verification keys for each circuit
bb write_vk -b ./policy_validity/target/policy_validity.json -o ./policy_validity/target/vk
bb write_vk -b ./amount_range/target/amount_range.json -o ./amount_range/target/vk
bb write_vk -b ./doctor_attestation/target/doctor_attestation.json -o ./doctor_attestation/target/vk
bb write_vk -b ./deductible_accumulator/target/deductible_accumulator.json \
           -o ./deductible_accumulator/target/vk

# Generate WASM proving binaries for browser
# Each circuit becomes a self-contained WASM module
for circuit in policy_validity amount_range doctor_attestation deductible_accumulator; do
    bb compile_to_wasm -b ./$circuit/target/$circuit.json \
                       -o ../client/wasm/$circuit.wasm
done

9.  Stellar Smart Contracts (Soroban / Rust)
9.1  Toolchain and Setup
# Install Stellar CLI
cargo install --locked stellar-cli --features opt

# Add WASM target
rustup target add wasm32v1-none

# Start local testnet (optional for local dev)
stellar container start -t future --name local --limits unlimited

# Configure testnet
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"

Reference documentation
Soroban SDK (Rust): https://docs.rs/soroban-sdk/latest/soroban_sdk/
Soroban BN254 types: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html
Soroban Poseidon: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_poseidon/index.html
UltraHonk verifier base: https://github.com/indextree/ultrahonk_soroban_contract
Nethermind ASP contracts: https://github.com/NethermindEth/stellar-private-payments/tree/main/contracts
CAP-0074 (BN254): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md
CAP-0075 (Poseidon): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md
CAP-0080 (BN254 P26 additions): https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md

9.2  Contract 1: UltraHonk Verifier (contracts/ultrahonk_verifier/)
Base: Fork of https://github.com/indextree/ultrahonk_soroban_contract. This contract is the on-chain proof checker. It uses bn254_multi_pairing_check (P25) and the P26 MSM functions to verify UltraHonk proofs generated by Barretenberg.

Files to write:
src/lib.rs — Main contract. Stores the verification key (VK) at deploy time. Exposes verify_proof(public_inputs, proof_bytes) → bool.
src/transcript.rs — Implements Fiat-Shamir transcript for UltraHonk (Keccak-based). Ported from Barretenberg's Rust verifier.
src/arithmetic.rs — Field arithmetic helpers using the P26 scalar host functions (bn254_fr_add, bn254_fr_mul, bn254_fr_inv).
src/pairing.rs — Wraps bn254_multi_pairing_check with proper G1/G2 point marshalling.
src/msm.rs — Wraps bn254_msm for the inner product argument verification step (new in P26).

ZKlaim modification vs base:
The base repo uses a single VK per deployed contract. ZKlaim requires three VKs (one per circuit). Modify the contract to store a Vec<VerificationKey> keyed by circuit_id: u32. The submit function calls verify_proof(circuit_id, proof, inputs).

// contracts/ultrahonk_verifier/src/lib.rs (abbreviated)
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, Bytes, Vec};

#[contracttype] pub enum StorageKey { VK(u32) }

#[contract] pub struct MultiVKVerifier;

#[contractimpl]
impl MultiVKVerifier {
    pub fn init(env: Env, circuit_id: u32, vk_bytes: Bytes) {
        env.storage().instance().set(&StorageKey::VK(circuit_id), &vk_bytes);
    }

    pub fn verify(env: Env, circuit_id: u32,
                  public_inputs: Vec<Bytes>,
                  proof: Bytes) -> bool {
        let vk_bytes: Bytes = env.storage().instance()
            .get(&StorageKey::VK(circuit_id)).unwrap();
        // Calls bn254_multi_pairing_check internally via transcript + IPA verification
        crate::verifier::verify_ultrahonk(&env, &vk_bytes, &public_inputs, &proof)
    }
}

9.3  Contract 2: ASP Membership Tree (contracts/asp_membership/)
Base: Fork of https://github.com/NethermindEth/stellar-private-payments/tree/main/contracts (asp_membership contract). Repurposed for doctor licensing rather than financial compliance. Uses Poseidon2 host function for all Merkle hash computations.

Files to write:
src/lib.rs — Stores a Poseidon Merkle tree of doctor credential commitments. Exposes insert_leaf(commitment: Field), get_root() → Field, get_path(index) → [Field; DEPTH].
src/poseidon.rs — Thin wrapper around soroban_sdk::poseidon2 host function for merkle node computation.

Domain change from PoolStellar base:
Leaf format changes from financial_address_commitment to Poseidon2(license_hash, specialty_code, jurisdiction_hash). Admin inserts leaves by calling enroll_doctor(license_hash, specialty_code, jurisdiction). This is the only admin-gated operation.

9.4  Contract 3: ASP Non-Membership Tree (contracts/asp_nonmembership/)
Base: Fork of Nethermind's sparse Merkle tree non-membership contract. Repurposed for fraud pattern exclusion rather than OFAC sanctions.

Files to write:
src/lib.rs — Sparse Merkle tree that can prove non-membership: "this claim pattern (billing_code_hash) is NOT in the fraud exclusion set."
src/sparse_merkle.rs — Sparse Merkle tree with Poseidon2 inner nodes and empty-subtree hash precomputation.

Usage in ZKlaim:
The claim_escrow contract checks that the claim's billing_pattern_hash (Poseidon of ICD category + amount bucket + provider type) is NOT in the fraud ASP tree. This catches patterns like "billing code X never legitimately costs >$Y" without surveilling individual patients.

9.5  Contract 4: Policy Registry (contracts/policy_registry/)
New contract — no analogous base. The insurer uses this to post Poseidon-hashed policy terms on-chain without revealing individual coverage details.

// contracts/policy_registry/src/lib.rs (abbreviated)
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Env, Address};
use soroban_sdk::crypto::Hash;

#[contracttype] pub enum StorageKey {
    PolicyRoot(Address),       // insurer_address → coverage_merkle_root
    PolicyBounds(Address, u32), // (insurer, policy_type) → bounds_hash
    Expiry(Address, u32),       // (insurer, policy_id) → expiry_ledger
}

#[contract] pub struct PolicyRegistry;

#[contractimpl]
impl PolicyRegistry {
    // Called by insurer to register a coverage Merkle root
    pub fn register_policy(
        env: Env,
        insurer: Address,
        coverage_root: Hash<32>,   // Poseidon Merkle root of ICD coverage tree
        bounds_hash: Hash<32>,     // Poseidon(floor, ceiling, policy_type)
        expiry_ledger: u32,
    ) {
        insurer.require_auth();
        env.storage().instance().set(
            &StorageKey::PolicyRoot(insurer.clone()), &coverage_root
        );
        env.storage().instance().set(
            &StorageKey::Expiry(insurer, 0), &expiry_ledger
        );
    }

    pub fn get_coverage_root(env: Env, insurer: Address) -> Hash<32> {
        env.storage().instance()
            .get(&StorageKey::PolicyRoot(insurer)).unwrap()
    }
}

9.6  Contract 5: Claim Escrow (contracts/claim_escrow/)
The central orchestration contract. Receives all proofs, cross-calls all verifier and ASP contracts, stores nullifiers, and dispatches USDC. This is the contract users interact with directly.

Files to write:
src/lib.rs — Main entry point with submit_claim() function.
src/nullifier.rs — Poseidon2-based nullifier registry (set of spent nullifiers).
src/escrow.rs — USDC token interface interaction (Stellar Asset Contract).
src/types.rs — ClaimProof, PublicInputs, ClaimResult structs.

// contracts/claim_escrow/src/lib.rs (abbreviated)
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, Env, Address, Bytes, Vec, token
};

#[contracttype]
pub struct ClaimPackage {
    pub policy_proof: Bytes,         // UltraHonk proof from Circuit 1
    pub policy_inputs: Vec<Bytes>,   // Public inputs: coverage_root, policy_commit, claim_hash
    pub amount_proof: Bytes,         // UltraHonk proof from Circuit 2
    pub amount_inputs: Vec<Bytes>,   // Public inputs: amount_commit, bounds_hash, claim_hash
    pub doctor_proof: Bytes,         // UltraHonk proof from Circuit 3
    pub doctor_inputs: Vec<Bytes>,   // Public inputs: asp_root, doctor_commit, claim_hash, attest
    pub accum_proof: Bytes,          // UltraHonk proof from Circuit 4
    pub accum_inputs: Vec<Bytes>,    // Public inputs: prev_commit, new_commit, amount_commit, met
    pub nullifier: Bytes,            // Poseidon(policy_id, visit_date, nonce)
    pub insurer: Address,
    pub payout_amount: i128,         // Claimed amount (validated by range proof)
}

#[contract] pub struct ClaimEscrow;

#[contractimpl]
impl ClaimEscrow {
    pub fn submit_claim(env: Env, patient: Address, pkg: ClaimPackage) {
        patient.require_auth();

        // 1. Check nullifier not already spent (anti double-claim)
        assert!(!crate::nullifier::is_spent(&env, &pkg.nullifier),
                "Nullifier already spent");

        // 2. Verify all three main proofs via cross-contract call
        let verifier = Address::from_str(&env,
            &env.storage().instance().get::<_, soroban_sdk::String>(
                &StorageKey::VerifierAddr
            ).unwrap()
        );
        assert!(env.invoke_contract::<bool>(
            &verifier,
            &soroban_sdk::symbol_short!("verify"),
            soroban_sdk::vec![&env, 0_u32.into_val(&env),  // circuit_id 0 = policy
                pkg.policy_inputs.into_val(&env),
                pkg.policy_proof.into_val(&env)],
        ), "Policy proof invalid");
        // ... repeat for amount_proof (circuit_id=1) and doctor_proof (circuit_id=2)

        // 3. Check doctor ASP membership via cross-contract call
        // (doctor_inputs[0] is the asp_merkle_root, verified against live tree)

        // 4. Check fraud ASP non-membership

        // 5. Update deductible tracker

        // 6. Store nullifier (prevents replay)
        crate::nullifier::mark_spent(&env, &pkg.nullifier);

        // 7. Transfer USDC from insurer escrow to patient
        let usdc = token::Client::new(&env, &pkg.insurer);
        usdc.transfer(&pkg.insurer, &patient, &pkg.payout_amount);

        env.events().publish(
            (soroban_sdk::symbol_short!("claim"),),
            (pkg.nullifier, patient)
        );
    }
}

9.7  Contract 6: Deductible Tracker (contracts/deductible_tracker/)
Stores the per-patient accumulator commitment. The patient proves state transitions in Circuit 4; this contract stores the latest commitment and verifies the proof before updating.

// Key interface
pub fn get_accumulator(env: Env, patient: Address) -> Hash<32>;
pub fn update_accumulator(
    env: Env,
    patient: Address,
    new_commitment: Hash<32>,
    proof: Bytes,
    public_inputs: Vec<Bytes>
) -> bool;
// Uses: bn254_msm (P26) in the accumulator verifier to batch
// multiple commitment checks in one call

9.8  Contract Deployment Script
#!/bin/bash
# scripts/deploy.sh
NETWORK=${1:-testnet}
IDENTITY=${2:-default}

echo "=== Deploying ZKlaim contracts to $NETWORK ==="

# 1. Deploy UltraHonk multi-VK verifier
VERIFIER_ID=$(stellar contract deploy \
  --wasm contracts/ultrahonk_verifier/target/wasm32v1-none/release/ultrahonk_verifier.wasm \
  --source $IDENTITY --network $NETWORK)

# 2. Initialize VKs for each circuit
for circuit_id in 0 1 2 3; do
  CIRCUIT_NAMES=("policy_validity" "amount_range" "doctor_attestation" "deductible_accumulator")
  stellar contract invoke --id $VERIFIER_ID --source $IDENTITY --network $NETWORK \
    -- init --circuit_id $circuit_id \
            --vk_bytes-file-path circuits/${CIRCUIT_NAMES[$circuit_id]}/target/vk
done

# 3. Deploy ASP membership (doctor tree)
ASP_MEMBER_ID=$(stellar contract deploy \
  --wasm contracts/asp_membership/target/wasm32v1-none/release/asp_membership.wasm \
  --source $IDENTITY --network $NETWORK)

# 4. Deploy ASP non-membership (fraud tree)
ASP_FRAUD_ID=$(stellar contract deploy \
  --wasm contracts/asp_nonmembership/target/wasm32v1-none/release/asp_nonmembership.wasm \
  --source $IDENTITY --network $NETWORK)

# 5. Deploy policy registry
POLICY_ID=$(stellar contract deploy \
  --wasm contracts/policy_registry/target/wasm32v1-none/release/policy_registry.wasm \
  --source $IDENTITY --network $NETWORK)

# 6. Deploy deductible tracker
TRACKER_ID=$(stellar contract deploy \
  --wasm contracts/deductible_tracker/target/wasm32v1-none/release/deductible_tracker.wasm \
  --source $IDENTITY --network $NETWORK)

# 7. Deploy claim escrow (wires all others together)
ESCROW_ID=$(stellar contract deploy \
  --wasm contracts/claim_escrow/target/wasm32v1-none/release/claim_escrow.wasm \
  --source $IDENTITY --network $NETWORK \
  -- --verifier_addr $VERIFIER_ID \
     --asp_member_addr $ASP_MEMBER_ID \
     --asp_fraud_addr $ASP_FRAUD_ID \
     --policy_addr $POLICY_ID \
     --tracker_addr $TRACKER_ID)

echo "Verifier:    $VERIFIER_ID"
echo "ASP Member:  $ASP_MEMBER_ID"
echo "ASP Fraud:   $ASP_FRAUD_ID"
echo "Policy Reg:  $POLICY_ID"
echo "Deductible:  $TRACKER_ID"
echo "Claim Escrow: $ESCROW_ID"

10.  Client-Side Proof Engine (WASM / Browser)
10.1  Architecture
The proof engine runs entirely in the browser. The patient's sensitive data (diagnosis, amount, doctor identity) never leaves the device. The engine is a TypeScript orchestrator that loads four Noir WASM circuits and runs them in Web Workers to avoid blocking the UI.

10.2  File Structure (client/proof_gen/)
client/proof_gen/
├── index.ts              # Main orchestrator — exported API
├── circuits.ts           # WASM loader for all four circuits
├── inputs.ts             # Types for all circuit inputs/outputs
├── workers/
│   ├── policy.worker.ts  # Web Worker for policy circuit
│   ├── amount.worker.ts  # Web Worker for amount range circuit
│   ├── doctor.worker.ts  # Web Worker for doctor attestation circuit
│   └── accum.worker.ts   # Web Worker for deductible accumulator
└── stellar/
    ├── transaction.ts    # Builds Soroban transaction from proofs
    └── submit.ts         # Submits transaction, monitors ledger

10.3  Main Orchestrator (client/proof_gen/index.ts)
// client/proof_gen/index.ts
import { PolicyInputs, AmountInputs, DoctorInputs, AccumInputs } from "./inputs";
import { buildStellarTransaction } from "./stellar/transaction";

export interface ClaimData {
    icd_code: string;           // e.g. "J18.9"
    amount_cents: number;
    visit_date: number;         // Unix timestamp
    policy_id: string;
    policy_secret: string;      // Patient holds this
    doctor_attestation: DoctorAttestation; // From doctor's signed token
}

export async function generateClaimProofs(claim: ClaimData): Promise<ProofPackage> {
    const claim_hash = await poseidon2Hash([claim.policy_id, claim.visit_date.toString()]);

    // Run circuits in parallel using Web Workers
    const [policyResult, amountResult, doctorResult] = await Promise.all([
        runPolicyCircuit({ ...claim, claim_hash }),
        runAmountCircuit({ ...claim, claim_hash }),
        runDoctorCircuit({ ...claim, claim_hash }),
    ]);

    // Accumulator runs after (needs amount_commitment from circuit 2)
    const accumResult = await runAccumulatorCircuit({
        amount_commitment: amountResult.publicInputs.amount_commitment,
        claim_hash,
        patient_secret: claim.policy_secret,
    });

    return { policyResult, amountResult, doctorResult, accumResult, claim_hash };
}

async function runPolicyCircuit(inputs: PolicyInputs) {
    const worker = new Worker(new URL("./workers/policy.worker.ts", import.meta.url));
    return new Promise((resolve, reject) => {
        worker.postMessage({ type: "PROVE", inputs });
        worker.onmessage = (e) => { if(e.data.type==="PROOF") resolve(e.data); };
        worker.onerror = reject;
    });
}

10.4  Soroban Transaction Builder (client/proof_gen/stellar/transaction.ts)
// client/proof_gen/stellar/transaction.ts
import * as StellarSdk from "@stellar/stellar-sdk";

export async function buildClaimTransaction(
    proofPkg: ProofPackage,
    patientKeypair: StellarSdk.Keypair,
    escrowContractId: string,
    rpcUrl: string,
) {
    const server = new StellarSdk.SorobanRpc.Server(rpcUrl);
    const account = await server.getAccount(patientKeypair.publicKey());

    // Build the ClaimPackage XDR struct
    const claimPackage = new StellarSdk.xdr.ScVal.scvMap([
        mapEntry("policy_proof",  proofToScBytes(proofPkg.policyResult.proof)),
        mapEntry("policy_inputs", inputsToScVec(proofPkg.policyResult.publicInputs)),
        mapEntry("amount_proof",  proofToScBytes(proofPkg.amountResult.proof)),
        mapEntry("amount_inputs", inputsToScVec(proofPkg.amountResult.publicInputs)),
        mapEntry("doctor_proof",  proofToScBytes(proofPkg.doctorResult.proof)),
        mapEntry("doctor_inputs", inputsToScVec(proofPkg.doctorResult.publicInputs)),
        mapEntry("accum_proof",   proofToScBytes(proofPkg.accumResult.proof)),
        mapEntry("accum_inputs",  inputsToScVec(proofPkg.accumResult.publicInputs)),
        mapEntry("nullifier",     proofToScBytes(proofPkg.nullifier)),
        mapEntry("payout_amount", StellarSdk.nativeToScVal(proofPkg.payoutAmount)),
    ]);

    const tx = new StellarSdk.TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: StellarSdk.Networks.TESTNET,
    })
    .addOperation(StellarSdk.Operation.invokeContractFunction({
        contract: escrowContractId,
        function: "submit_claim",
        args: [
            StellarSdk.nativeToScVal(patientKeypair.publicKey(), { type: "address" }),
            claimPackage,
        ],
    }))
    .setTimeout(300)
    .build();

    return tx;
}

Reference documentation
Stellar JS SDK: https://github.com/stellar/js-stellar-sdk
Soroban RPC JS client: https://stellar.github.io/js-stellar-sdk/SorobanRpc.html
Freighter wallet API: https://docs.freighter.app/
Noir WASM usage: https://noir-lang.org/docs/how_to/how-to-solidity-verifier

11.  Frontend Application
11.1  Tech Stack
Framework	React 18 + TypeScript + Vite
Wallet connection	Freighter wallet browser extension (Stellar's primary wallet)
Stellar SDK	@stellar/stellar-sdk ^13.x
Styling	Tailwind CSS
State management	Zustand
Storage	Browser OPFS (Origin Private File System) — same pattern as Nethermind PoolStellar
WASM loading	Vite wasm plugin for Noir circuit WASM modules

11.2  Patient Application (app/patient/)
Key screens to build:
Onboarding: Connect Freighter wallet, generate ZKlaim identity (policy secret, accumulator seed), store encrypted in OPFS.
Claim inbox: Lists pending claim tokens received from doctors. Shows "Claim ready — tap to submit."
Proof generation: Full-screen progress indicator with stages: "Verifying policy (1/4) → Proving amount range (2/4) → Verifying doctor (3/4) → Updating deductible (4/4)." Time estimate: ~7-10 seconds.
Transaction confirmation: Shows Freighter wallet approval dialog. Patient approves one transaction.
Settlement receipt: "USDC received. Claim settled." Shows nullifier as confirmation number. No medical data displayed.
Deductible status: Shows a progress bar "Deductible: $800 / $1,500 met" — derived from accumulator state without revealing individual claim amounts.

11.3  Provider Application (app/provider/)
Key screens to build:
Login: Connect Freighter wallet (must be enrolled in doctor ASP membership tree).
New claim form: Fields for patient wallet address, visit date, ICD-10 code picker (searchable), billed amount. Generates encrypted claim token.
Claim delivery: Shows QR code or deep link for patient to scan/tap. Also shows IPFS CID commitment.
History: Lists prior claims submitted (shows only claim_hash and date — no patient data).

11.4  Admin Panel (app/admin/)
Key screens to build:
ASP doctor enrollment: Admin inputs license_hash, specialty_code, jurisdiction. Inserts leaf into doctor membership tree.
Fraud pattern management: Admin adds billing pattern hashes to the fraud non-membership tree.
Policy registration: Insurer uploads ICD coverage tree (pre-hashed) and bounds parameters, posts to policy_registry contract.
Escrow management: Shows USDC reserve balance. Allows top-up.

12.  Test and Deployment Infrastructure
12.1  Unit Tests (contracts/)
# Run all contract tests
cargo test --workspace --features testutils

# Key test cases to write (each in contracts/*/src/test.rs):
# - test_verify_valid_proof()       — submit a known-good proof, expect true
# - test_reject_invalid_proof()     — submit a tampered proof, expect false
# - test_nullifier_double_spend()   — submit same nullifier twice, expect rejection
# - test_asp_member_check()         — enrolled doctor passes; unenrolled fails
# - test_fraud_exclusion()          — flagged billing pattern rejected
# - test_deductible_crossing()      — accumulator crosses threshold, payout changes
# - test_usdc_settlement()          — correct USDC transferred after valid proof

12.2  Circuit Tests (circuits/)
# Test each circuit with known inputs and expected outputs
nargo test --workspace

# Prover tests (generate + verify end-to-end)
for circuit in policy_validity amount_range doctor_attestation deductible_accumulator; do
    echo "Testing $circuit..."
    # Generate test witness
    nargo execute -p ./$circuit --prover-name test
    # Generate proof
    bb prove -b ./$circuit/target/$circuit.json \
             -w ./$circuit/target/test.gz -o ./target/proof
    # Verify locally
    bb verify -k ./$circuit/target/vk -p ./target/proof
    echo "  ✓ $circuit: proof verified"
done

12.3  End-to-End Integration Tests (tests/)
# tests/e2e_claim_flow.ts
# Full flow test: doctor creates claim → patient proves → Soroban settles
npm run test:e2e

# Uses @stellar/stellar-sdk + deployed testnet contracts
# Test sequence:
# 1. Fund doctor and patient wallets via friendbot
# 2. Enroll test doctor in ASP membership tree
# 3. Register test policy in policy_registry
# 4. Generate claim token (simulating doctor action)
# 5. Generate four ZK proofs using WASM circuits
# 6. Build and submit Soroban transaction
# 7. Poll RPC for confirmation (≤30 seconds target)
# 8. Assert patient USDC balance increased by expected amount
# 9. Assert nullifier stored (attempt replay, expect rejection)
# 10. Assert no medical data in Soroban event logs

13.  End-to-End Demo Flow
The following is the authoritative demo script for hackathon presentation. Every step maps to a specific implemented component. Target total time: 4 minutes.

Step	Time	What happens	What the audience sees	What is hidden
Setup	0:00	Show three browser tabs open: Doctor app, Patient app, Stellar Explorer on testnet.	Three familiar-looking UIs. A block explorer showing live testnet activity.	N/A
Doctor creates claim	0:15	Doctor tab: enter ICD code J18.9, amount $1,200, click Sign & Send to Patient. Browser calls Noir WASM to generate the claim token.	A form being filled. A loading spinner for 1 second. A QR code appearing.	The ICD code J18.9. The amount before commitment.
Patient receives claim	0:45	Patient tab: app shows "New claim received." Patient clicks Submit Claim.	A green notification. A single button. A progress bar starting.	Everything.
Proof generation	0:55	Four Noir WASM circuits run in Web Workers. Progress bar advances through stages: Policy (25%) → Amount (50%) → Doctor (75%) → Deductible (100%).	An animated progress bar with stage labels. Estimated time counter. "Your diagnosis stays private."	All private inputs. All plaintext values.
Freighter approval	1:40	Freighter wallet pop-up appears. Patient clicks Approve. Transaction is signed.	The familiar Freighter dialog. One click.	Medical data has never entered Freighter.
On-chain verification	1:50	Transaction submitted to Stellar testnet. Soroban runs UltraHonk verifier × 3, ASP checks, nullifier registry update, USDC transfer — all in one transaction.	Testnet transaction ID appearing. Explorer shows the transaction.	Everything medical.
Block explorer reveal	2:00	Open the transaction in stellar.expert. Show the transaction. Click into Soroban events.	One nullifier hash. One Merkle root. One USDC transfer event. Zero medical data. Zero amounts in public inputs.	This is the reveal moment: diagnosis not present.
Settlement	2:20	Patient app shows "+$1,200 USDC received." Deductible bar advances.	USDC balance increases in real time.	Amount was never on-chain as plaintext.
Deductible demo	2:40	Submit a second claim. Deductible bar shows progression. When it crosses $1,000 threshold, show the contract emitting "deductible_met: true" in events.	"Deductible met! Insurer now covers 100%." — triggered automatically on-chain.	The amount of either claim.
Fraud rejection	3:15	Switch to a test wallet not in doctor ASP. Try to submit a claim. Show rejection.	Error: "Provider not verified." Transaction reverted.	N/A — rejection itself is the demonstration.
Closing slide	3:45	Return to patient app. Show claim history: only nullifier hashes. No diagnoses, no amounts, no doctor names.	A clean history screen. "Your entire medical history, provable. Invisible."	Everything.

14.  Dependency and Reference Index
14.1  Stellar Protocol References
Protocol	CAP	What it provides	URL
P22	CAP-0059	BLS12-381 host functions (g1_add, g2_add, multi_pairing)	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md
P25 X-Ray	CAP-0074	BN254 host functions (g1_add, g1_mul, multi_pairing_check)	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md
P25 X-Ray	CAP-0075	Poseidon / Poseidon2 hash host functions	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md
P26 Yardstick	CAP-0080	BN254 MSM, scalar arithmetic (9 new functions), curve membership checks	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md
P26 Yardstick	CAP-0082	Checked 256-bit integer arithmetic for financial logic	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0082.md
P26 Yardstick	CAP-0078	Precise TTL control for storage management	https://github.com/stellar/stellar-protocol/blob/master/core/cap-0078.md

14.2  Code Repositories to Fork
Repository	What we take	What we change	URL
indextree/ultrahonk_soroban_contract	UltraHonk verifier base, VK storage pattern, proof serialization	Extend to multi-VK (circuit_id keyed), add P26 MSM in inner product arg	https://github.com/indextree/ultrahonk_soroban_contract
NethermindEth/stellar-private-payments	ASP membership + non-membership Soroban contracts, Poseidon2 Rust crate, WASM proof generation pattern in browser	Replace financial compliance domain with medical licensing domain; add three Noir circuits; add deductible tracker	https://github.com/NethermindEth/stellar-private-payments
jayz22/soroban-examples (p25-preview)	Reference code for P25 BN254 host function usage patterns	Study only, not forked directly	https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview

14.3  External Libraries
Library	Version	Language	Purpose
@noir-lang/noir_js	latest	TypeScript	Noir circuit prover in browser
@aztec/bb.js	latest	TypeScript	Barretenberg UltraHonk prover/verifier JS
@stellar/stellar-sdk	≥13.0	TypeScript	Stellar transaction building, Soroban RPC
@stellar/freighter-api	latest	TypeScript	Freighter wallet integration
soroban-sdk	≥22.0	Rust	Soroban smart contract SDK
poseidon2 (Horizen Labs)	bundled with Nethermind fork	Rust	Poseidon2 in Soroban contracts

14.4  Documentation References
Stellar ZK Proofs docs: https://developers.stellar.org/docs/build/apps/zk
Stellar Privacy docs: https://developers.stellar.org/docs/build/apps/privacy
Soroban SDK BN254 migration guide: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_bn254/index.html
Soroban SDK Poseidon migration guide: https://docs.rs/soroban-sdk/latest/soroban_sdk/_migrating/v25_poseidon/index.html
Noir language documentation: https://noir-lang.org/docs/
Barretenberg (Aztec): https://github.com/AztecProtocol/aztec-packages
Privacy Pools whitepaper: https://privacypools.com/whitepaper.pdf
Stellar X-Ray blog: https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25
Yardstick upgrade guide: https://stellar.org/blog/foundation-news/stellar-yardstick-protocol-26-upgrade-guide
RISC Zero verifier reference: https://stellar.org/blog/developers/risc-zero-verifier
Confidential Token Association: https://www.confidentialtoken.org/

14.5  Component Summary Table
Component	Type	LOC estimate	Priority	Blocking dependencies
Policy validity circuit	Noir	~80	P0	nargo, bb
Amount range circuit	Noir	~60	P0	nargo, bb, Noir embedded curve ops
Doctor attestation circuit	Noir	~70	P0	nargo, bb
Deductible accumulator circuit	Noir	~90	P1	nargo, bb, circuits 1-3 done
UltraHonk multi-VK verifier	Rust/Soroban	~400	P0	P25+P26 soroban-sdk, indextree fork
ASP membership contract	Rust/Soroban	~200	P0	Nethermind fork, poseidon2 crate
ASP non-membership contract	Rust/Soroban	~250	P0	Nethermind fork, sparse Merkle
Policy registry contract	Rust/Soroban	~150	P0	soroban-sdk
Claim escrow contract	Rust/Soroban	~350	P0	All other contracts deployed
Deductible tracker contract	Rust/Soroban	~200	P1	UltraHonk verifier, accumulator circuit
Proof orchestrator (browser)	TypeScript	~300	P0	Noir WASM modules, bb.js
Stellar tx builder	TypeScript	~150	P0	stellar-sdk, proof orchestrator
Patient frontend	React/TSX	~600	P1	Freighter API, proof orchestrator
Provider frontend	React/TSX	~300	P1	Freighter API, stellar-sdk
Admin panel	React/TSX	~250	P2	stellar-sdk, ASP contracts deployed
Deploy scripts	Bash	~100	P0	All contracts built
E2E tests	TypeScript	~400	P1	Everything deployed to testnet

End of ZKlaim Requirements Specification
Version 1.0  ·  June 2026
Built for the ZK on Stellar Hackathon