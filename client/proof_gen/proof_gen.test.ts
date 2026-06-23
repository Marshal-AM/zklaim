import { describe, expect, it } from "vitest";
import {
  generateClaimProofs,
  buildClaimPackage,
  PROOF_BYTES,
  type ProofProgressStage,
} from "./index.js";
import { loadDemoClaimData } from "./demo.js";

describe("hydrateClaimData", () => {
  it("builds ClaimData matching demo fixture shape", async () => {
    const claim = await loadDemoClaimData();
    expect(claim.icd_code).toBe("J18.9");
    expect(claim.amount_cents).toBe(100);
    expect(claim.doctor_attestation.doctor_leaf_index).toBeGreaterThanOrEqual(0);
    expect(claim.policy_commitment).toBeGreaterThan(0n);
  });
});

describe("generateClaimProofs onProgress", () => {
  it("fires progress stages in valid order", async () => {
    const claim = await loadDemoClaimData();
    const stages: ProofProgressStage[] = [];
    await generateClaimProofs(claim, {
      useWorkers: false,
      onProgress: (stage) => {
        stages.push(stage);
      },
    });
    expect(stages).toContain("policy");
    expect(stages).toContain("amount");
    expect(stages).toContain("doctor");
    expect(stages).toContain("accum");
    expect(stages).toContain("nullifier");
    expect(stages.indexOf("accum")).toBeGreaterThan(stages.indexOf("policy"));
  });
});

describe("generateClaimProofs", () => {
  it("proves demo claim with four circuits", async () => {
    const claim = await loadDemoClaimData();
    const pkg = await generateClaimProofs(claim, { useWorkers: false });

    expect(pkg.policyResult.proof.length).toBe(PROOF_BYTES);
    expect(pkg.amountResult.proof.length).toBe(PROOF_BYTES);
    expect(pkg.doctorResult.proof.length).toBe(PROOF_BYTES);
    expect(pkg.accumResult.proof.length).toBe(PROOF_BYTES);

    expect(pkg.policyResult.publicInputs).toHaveLength(3);
    expect(pkg.amountResult.publicInputs).toHaveLength(3);
    expect(pkg.doctorResult.publicInputs).toHaveLength(4);
    expect(pkg.accumResult.publicInputs).toHaveLength(5);

    expect(pkg.amountResult.publicInputs[0]).toBe(
      pkg.accumResult.publicInputs[2],
    );

    const claimHash = pkg.claim_hash;
    expect(pkg.policyResult.publicInputs[2]).toBe(claimHash);
    expect(pkg.amountResult.publicInputs[2]).toBe(claimHash);
    expect(pkg.doctorResult.publicInputs[2]).toBe(claimHash);
    expect(pkg.accumResult.publicInputs[4]).toBe(claimHash);

    const onChain = buildClaimPackage(pkg);
    expect(onChain.policy_inputs).toHaveLength(3);
    expect(onChain.nullifier).toHaveLength(32);
    expect(onChain.fraud_non_membership_proof.length).toBeGreaterThan(0);
    expect(onChain.fraud_path_indices.length).toBeGreaterThan(0);
  });
});
