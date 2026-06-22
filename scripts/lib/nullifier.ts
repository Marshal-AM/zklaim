import { initPoseidon2, poseidon2HashFixed } from "./poseidon2.js";
import { stringToField } from "./field.js";

export interface NullifierInput {
  policyId: string;
  visitDate: number;
  diagnosisSecret: bigint;
  randomNonce: bigint;
}

export interface ClaimHashInput {
  visitDate: number;
  policyId: string;
  nonce: bigint;
}

/** Poseidon2([policy_id, visit_date, diagnosis_secret, random_nonce], 4) */
export async function computeNullifier(input: NullifierInput): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([
    stringToField(input.policyId),
    BigInt(input.visitDate),
    input.diagnosisSecret,
    input.randomNonce,
  ]);
}

/** Poseidon2([visit_date, policy_id, nonce], 3) — links all circuits */
export async function computeClaimHash(input: ClaimHashInput): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([
    BigInt(input.visitDate),
    stringToField(input.policyId),
    input.nonce,
  ]);
}

/** Doctor credential secret from enrollment material */
export async function computeDoctorSecret(
  licenseHash: bigint,
  specialtyCode: bigint,
  jurisdictionHash: bigint,
): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([licenseHash, specialtyCode, jurisdictionHash]);
}

/** ASP circuit leaf / doctor commitment */
export async function computeDoctorLeaf(doctorSecret: bigint): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([doctorSecret]);
}

/** Policy coverage leaf for ICD code field */
export async function computePolicyLeaf(icdCodeField: bigint): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([icdCodeField]);
}
