import {
  amountBucketToField,
  billingPatternHash,
  fieldFromHex,
  fieldToBytesBE,
  icdCategoryToField,
  initPoseidon2,
  providerPatternToField,
  SparseMerkleTree,
} from "@zklaim/scripts";
import type {
  BillingPattern,
  ClaimData,
  FraudProofData,
  FraudTreeArtifact,
} from "./inputs.js";
import { isNodeRuntime } from "./runtime.js";

let fraudTreeOverride: FraudTreeArtifact | null = null;

export function setFraudTreeJson(tree: FraudTreeArtifact): void {
  fraudTreeOverride = tree;
}

export async function computeBillingPatternHash(
  icdCode: string,
  billing: BillingPattern,
): Promise<bigint> {
  await initPoseidon2();
  return billingPatternHash(
    icdCategoryToField(icdCode),
    amountBucketToField(billing.amount_bucket_min, billing.amount_bucket_max),
    providerPatternToField(billing.provider_pattern),
  );
}

export async function rebuildFraudSmtFromArtifact(
  tree: FraudTreeArtifact,
): Promise<SparseMerkleTree> {
  const smt = new SparseMerkleTree();
  await smt.init();
  for (const leaf of tree.leaves) {
    await smt.insert(fieldFromHex(leaf.billing_pattern_hash));
  }
  const artifactRoot = fieldFromHex(tree.root);
  if (smt.getRoot() !== artifactRoot) {
    throw new Error(
      "fraud_tree.json is internally inconsistent — run npm run build:trees",
    );
  }
  return smt;
}

async function fraudProofFromArtifact(
  billing_pattern_hash: bigint,
  tree: FraudTreeArtifact,
  icdCode: string,
): Promise<FraudProofData> {
  const clean = tree.clean_pattern;
  const artifactHash = fieldFromHex(clean.billing_pattern_hash);
  if (artifactHash === billing_pattern_hash) {
    return {
      billing_pattern_hash,
      fraud_non_membership_proof: clean.non_membership_proof.path.map((p) =>
        fieldToBytesBE(fieldFromHex(p)),
      ),
      fraud_path_indices: clean.non_membership_proof.path_indices,
    };
  }

  const smt = await rebuildFraudSmtFromArtifact(tree);
  if (smt.has(billing_pattern_hash)) {
    throw new Error(
      `Billing pattern for ICD ${icdCode} matches the on-chain fraud blacklist`,
    );
  }
  const proof = await smt.getNonMembershipProof(billing_pattern_hash);
  return {
    billing_pattern_hash,
    fraud_non_membership_proof: proof.path.map((p) => fieldToBytesBE(p)),
    fraud_path_indices: proof.pathIndices,
  };
}

async function resolveFraudTree(
  fraudTreeJson?: FraudTreeArtifact,
): Promise<FraudTreeArtifact | null> {
  if (fraudTreeJson) return fraudTreeJson;
  if (fraudTreeOverride) return fraudTreeOverride;
  if (isNodeRuntime()) {
    const { loadFraudTreeFromFs } = await import("./fraud_node.js");
    return loadFraudTreeFromFs();
  }
  const { loadFraudTreeFromFetch } = await import("./browserArtifacts.js");
  return loadFraudTreeFromFetch();
}

export async function resolveFraudProof(
  claim: ClaimData,
  fraudTreeJson?: FraudTreeArtifact,
): Promise<FraudProofData> {
  const billing_pattern_hash = await computeBillingPatternHash(
    claim.icd_code,
    claim.billing,
  );

  const tree = await resolveFraudTree(fraudTreeJson);
  if (tree) {
    return fraudProofFromArtifact(billing_pattern_hash, tree, claim.icd_code);
  }

  const smt = new SparseMerkleTree();
  await smt.init();
  const proof = await smt.getNonMembershipProof(billing_pattern_hash);
  return {
    billing_pattern_hash,
    fraud_non_membership_proof: proof.path.map((p) => fieldToBytesBE(p)),
    fraud_path_indices: proof.pathIndices,
  };
}
