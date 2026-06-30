## The idea: ZKlaim

**What a normal person sees:** An app where you press "Submit Claim," wait five seconds for a proof to generate silently in your browser, and then watch USDC land in your wallet — without ever telling the blockchain what your diagnosis was.

**Why this is the right problem:** Medical privacy is the most viscerally understood privacy need on earth. Everyone has had a diagnosis they don't want their employer, insurer underwriter, government, or nosy neighbour to know about. Every insurance claim today forces a choice: get reimbursed or preserve your medical privacy. ZKlaim eliminates that choice. And unlike remittances or B2B settlement, you can explain this to a grandmother in 10 seconds.

---

### The surface (simple)

A doctor fills in a form with an ICD diagnosis code, a treatment date, and a cost. They sign it with their wallet key (which is in the ASP whitelist). The patient opens the app, sees "Claim ready," presses one button. The browser generates three ZK proofs locally in ~5–8 seconds using Noir + Barretenberg compiled to WASM. Nothing sensitive ever leaves the device. The proof is posted to Stellar testnet. The Soroban verifier contract runs. USDC moves. Done.

---

### The depth (complex — what no one on Stellar has built yet)

**Three Noir circuits running in parallel:**

The *policy circuit* proves the patient holds a valid, non-expired insurance policy that covers the ICD code category — without revealing what the ICD code actually is. This is a set-membership proof: the circuit checks that the diagnosis falls within a covered range using a private Merkle branch.

The *amount range circuit* proves the claimed amount is above zero and below the policy maximum using a Pedersen commitment and BN254 `g1_mul` — the exact host function added in P25. The on-chain contract sees only the commitment, not the number.

The *doctor attestation circuit* proves the doctor who signed the claim is a member of the licensed-physician Merkle tree (the ASP) — without naming the doctor. This is the Privacy Pool ASP architecture from Nethermind's PoolStellar, repurposed: instead of financial compliance, it's professional licensing compliance.

**The moonshot — recursive private running totals:**

Insurance has a deductible: you personally pay the first $1,500 per year, and the insurer pays everything above that. Tracking this normally requires revealing every prior claim. The genuinely new thing built here is a Poseidon-based accumulator circuit: each new claim takes a commitment to the previous running total as a private input, adds the new amount privately, and outputs a new commitment. The circuit proves the new total exceeds the deductible threshold (triggering full insurer payment) without revealing any individual claim or running total.

This is proof aggregation — the hackathon's own "wild" category item — running on Stellar's P26 BN254 multi-scalar multiplication host function, which makes batching the commitments affordable. No one on Stellar has built this yet. It would be a genuinely new cryptographic primitive demonstrated on-chain.

**How every single Stellar ZK primitive is used meaningfully:**

`poseidon` and `poseidon2` generate nullifiers (preventing double-claiming the same doctor visit), Merkle tree commitments in the policy tree and doctor ASP tree, and the running deductible accumulator. The same Poseidon instance runs identically inside the Noir circuit and inside the Soroban contract — that consistency is the point of the host function.

`bn254_g1_mul` creates Pedersen commitments to claim amounts. The patient commits to a number without revealing it, and the circuit proves properties about the committed number.

`bn254_multi_pairing_check` is the final verification step inside the UltraHonk Soroban verifier — the contract that `indextree/ultrahonk_soroban_contract` already provides as a forkable base. This is the bottleneck of every Noir proof verification on Stellar, and P25 made it native.

`bn254_msm` (P26) aggregates multiple claim commitments into a single batched verification, making the deductible accumulator affordable at scale. This is the single most important P26 addition, and ZKlaim is the first project to use it for something users actually care about.

The ASP membership and non-membership trees run exactly as in Nethermind's PoolStellar — but instead of financial sanctions, the membership tree is licensed physicians and the non-membership tree is known fraudulent billing patterns.

**What this demonstrates that doesn't exist anywhere:**

A recursive ZK accumulator for private financial state — where the state (deductible progress) updates provably without ever being revealed — built on Stellar's host functions. This is not just a hackathon project. If it works, it is a primitive that any insurance protocol, subscription product, or recurring payment system on Stellar could use. The judges get a "Submit Claim" button. Behind it is the most sophisticated ZK engineering Stellar has seen.