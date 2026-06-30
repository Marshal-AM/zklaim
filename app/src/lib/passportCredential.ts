import { fieldFromHex, fieldToHex } from "@zklaim/scripts";
import { proveCategoryNonMembershipCircuit } from "@zklaim/proof-gen/circuits";
import {
  icdLetterToField,
  type LocalLeafRecord,
  type PassportLocalStore,
} from "./passport";
import { fetchPassportMerklePath } from "./passportContract";

/** Sort by on-chain index and refresh merkle siblings from the contract. */
export async function refreshPassportLeavesForProve(
  patient: string,
  store: PassportLocalStore,
): Promise<LocalLeafRecord[]> {
  const sorted = [...store.leaves].sort((a, b) => a.leaf_index - b.leaf_index);
  return Promise.all(
    sorted.map(async (leaf) => {
      if (leaf.leaf_index < 0) {
        throw new Error(
          "Passport leaf is missing on-chain index — remove and re-add the claim to your passport.",
        );
      }
      const merkle_path = await fetchPassportMerklePath(
        patient,
        leaf.leaf_index,
      );
      return { ...leaf, merkle_path };
    }),
  );
}

export async function proveCategoryNonMembership(params: {
  store: PassportLocalStore;
  passportRoot: bigint;
  excludedCategory: string;
  leaves?: LocalLeafRecord[];
}): Promise<{ proof: Uint8Array; publicInputs: string[] }> {
  const leaves = params.leaves ?? params.store.leaves;
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
