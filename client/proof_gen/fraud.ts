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

function fraudProofFromArtifact(
  billing_pattern_hash: bigint,
  tree: FraudTreeArtifact,
): FraudProofData {
  const clean = tree.clean_pattern;
  const artifactHash = fieldFromHex(clean.billing_pattern_hash);
  if (artifactHash !== billing_pattern_hash) {
    throw new Error(
      "billing_pattern_hash does not match fraud_tree clean_pattern — rebuild trees",
    );
  }
  return {
    billing_pattern_hash,
    fraud_non_membership_proof: clean.non_membership_proof.path.map((p) =>
      fieldToBytesBE(fieldFromHex(p)),
    ),
    fraud_path_indices: clean.non_membership_proof.path_indices,
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
    return fraudProofFromArtifact(billing_pattern_hash, tree);
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
