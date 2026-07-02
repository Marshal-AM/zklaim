import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fieldFromHex } from "@zklaim/scripts";
import {
  computeBillingPatternHash,
  rebuildFraudSmtFromArtifact,
  resolveFraudProof,
  type FraudTreeArtifact,
} from "./fraud.js";
import { loadDemoClaimData } from "./demo.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAUD_ARTIFACT = join(
  __dirname,
  "..",
  "..",
  "scripts",
  "artifacts",
  "fraud_tree.json",
);

function loadFraudTree(): FraudTreeArtifact {
  if (!existsSync(FRAUD_ARTIFACT)) {
    throw new Error("Missing fraud_tree.json — run npm run build:trees");
  }
  return JSON.parse(readFileSync(FRAUD_ARTIFACT, "utf8")) as FraudTreeArtifact;
}

describe("resolveFraudProof", () => {
  it("uses clean_pattern fast path for demo J18.9 billing bucket", async () => {
    const claim = await loadDemoClaimData();
    const tree = loadFraudTree();
    const proof = await resolveFraudProof(claim, tree);
    expect(proof.fraud_non_membership_proof.length).toBeGreaterThan(0);
    expect(proof.fraud_path_indices.length).toBeGreaterThan(0);
    expect(proof.billing_pattern_hash).toBe(
      fieldFromHex(tree.clean_pattern.billing_pattern_hash),
    );
  });

  it("builds a dynamic non-membership proof for non-J18.9 ICD codes", async () => {
    const claim = await loadDemoClaimData();
    claim.icd_code = "F32.9";
    const tree = loadFraudTree();
    const proof = await resolveFraudProof(claim, tree);
    const expected = await computeBillingPatternHash(
      "F32.9",
      claim.billing,
    );
    expect(proof.billing_pattern_hash).toBe(expected);
    expect(proof.billing_pattern_hash).not.toBe(
      fieldFromHex(tree.clean_pattern.billing_pattern_hash),
    );
    expect(proof.fraud_non_membership_proof.length).toBeGreaterThan(0);
  });

  it("rebuildFraudSmtFromArtifact matches artifact root", async () => {
    const tree = loadFraudTree();
    const smt = await rebuildFraudSmtFromArtifact(tree);
    expect(smt.getRoot()).toBe(fieldFromHex(tree.root));
  });
});
