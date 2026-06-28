import { fieldFromHex } from "@zklaim/scripts";
import { proveCategoryNonMembershipCircuit } from "@zklaim/proof-gen/circuits";
import { fieldToHex } from "@zklaim/scripts";
import {
  icdLetterToField,
  type PassportLocalStore,
} from "./passport";

export async function proveCategoryNonMembership(params: {
  store: PassportLocalStore;
  passportRoot: bigint;
  excludedCategory: string;
}): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  const leaves = params.store.leaves;
  const result = await proveCategoryNonMembershipCircuit({
    passport_root: params.passportRoot,
    excluded_category: icdLetterToField(params.excludedCategory),
    claim_count: leaves.length,
    leaf_nullifiers: leaves.map((l) => fieldFromHex(l.nullifier)),
    leaf_secrets: leaves.map((l) => fieldFromHex(l.leaf_secret)),
    leaf_categories: leaves.map((l) => icdLetterToField(l.icd_category)),
    leaf_amount_bkts: leaves.map((l) => BigInt(l.amount_bucket)),
    leaf_months: leaves.map((l) => BigInt(l.visit_month)),
    merkle_paths: leaves.map((l) =>
      l.merkle_path.map((p) => fieldFromHex(p)),
    ),
    leaf_active: leaves.map(() => true),
  });

  return {
    proof: result.proof,
    publicInputs: result.publicInputs.map((f) => fieldToHex(f)),
  };
}
