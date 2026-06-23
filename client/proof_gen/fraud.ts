import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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
import type { BillingPattern, ClaimData, FraudProofData } from "./inputs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const FRAUD_ARTIFACT = join(ROOT, "scripts", "artifacts", "fraud_tree.json");

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

export async function resolveFraudProof(claim: ClaimData): Promise<FraudProofData> {
  const billing_pattern_hash = await computeBillingPatternHash(
    claim.icd_code,
    claim.billing,
  );

  if (existsSync(FRAUD_ARTIFACT)) {
    const tree = JSON.parse(readFileSync(FRAUD_ARTIFACT, "utf8")) as {
      clean_pattern: {
        billing_pattern_hash: string;
        non_membership_proof: {
          path: string[];
          path_indices: number[];
        };
      };
    };
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

  const smt = new SparseMerkleTree();
  await smt.init();
  const proof = await smt.getNonMembershipProof(billing_pattern_hash);
  return {
    billing_pattern_hash,
    fraud_non_membership_proof: proof.path.map((p) => fieldToBytesBE(p)),
    fraud_path_indices: proof.pathIndices,
  };
}
