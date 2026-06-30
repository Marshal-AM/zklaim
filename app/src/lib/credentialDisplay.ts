import { fieldFromHex, fieldToHex, stringToField } from "@zklaim/scripts";
import { ICD_CATEGORY_NAMES, EXCLUDABLE_CATEGORIES } from "./passportCategories";

export const CIRCUIT_NAMES: Record<number, string> = {
  0: "policy_validity",
  1: "amount_range",
  2: "doctor_attestation",
  3: "deductible_accumulator",
  4: "category_nonmembership",
};

export function decodeCategoryNonMembershipInputs(publicInputHex: string[]) {
  const passportRoot = publicInputHex[0] ?? "0x0";
  const excludedField = publicInputHex[1] ?? "0x0";
  const claimCount = publicInputHex[2]
    ? Number(fieldFromHex(publicInputHex[2]))
    : 0;
  return { passportRoot, excludedField, claimCount };
}

/** Best-effort map excluded field back to ICD letter (demo categories). */
export function letterFromExcludedField(fieldHex: string): string | null {
  const target = fieldHex.toLowerCase().replace(/^0x/, "");
  for (const letter of EXCLUDABLE_CATEGORIES) {
    const hex = fieldToHex(stringToField(letter)).toLowerCase().replace(/^0x/, "");
    if (hex === target) return letter;
  }
  return null;
}

export function categoryLabel(letter: string): string {
  return ICD_CATEGORY_NAMES[letter] ?? `Category ${letter}`;
}

export function credentialValidityLabel(valid: boolean): string {
  return valid ? "Valid on-chain" : "Expired or invalid";
}
