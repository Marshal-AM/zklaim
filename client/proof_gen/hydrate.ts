import {
  computeClaimHash,
  fieldFromHex,
  icdToField,
  initPoseidon2,
  poseidon2HashFixed,
  stringToField,
} from "@zklaim/scripts";
import type { AccumulatorState, ClaimData } from "./inputs.js";

export interface PolicyTreeArtifact {
  root: string;
  leaves: Array<{
    icd_code: string;
    index: number;
    merkle_path: string[];
  }>;
}

export interface AspTreeArtifact {
  root: string;
  doctors: Array<{
    license_id: string;
    doctor_secret: string;
    doctor_commitment: string;
    index: number;
    merkle_path: string[];
  }>;
}

export interface HydrateClaimParams {
  icd_code: string;
  amount_cents: number;
  visit_date: number;
  policy_id: string;
  nonce: bigint;
  policy_secret: bigint;
  diagnosis_secret: bigint;
  random_nonce: bigint;
  policy_floor_cents: number;
  policy_ceiling_cents: number;
  blinding_factor: bigint;
  accumulator: AccumulatorState;
  billing: ClaimData["billing"];
  insurer: string;
  doctor_license_id: string;
  policyTree: PolicyTreeArtifact;
  aspTree: AspTreeArtifact;
}

export async function hydrateClaimData(
  params: HydrateClaimParams,
): Promise<ClaimData> {
  await initPoseidon2();

  const icdLeaf = params.policyTree.leaves.find(
    (l) => l.icd_code === params.icd_code,
  );
  if (!icdLeaf) {
    throw new Error(`${params.icd_code} not in policy tree`);
  }

  const doctor = params.aspTree.doctors.find(
    (d) => d.license_id === params.doctor_license_id,
  );
  if (!doctor) {
    throw new Error(`${params.doctor_license_id} not in ASP tree`);
  }

  const icdField = icdToField(icdLeaf.icd_code);
  const policyCommitment = await poseidon2HashFixed([
    icdField,
    params.policy_secret,
  ]);
  const claimHash = await computeClaimHash({
    visitDate: params.visit_date,
    policyId: params.policy_id,
    nonce: params.nonce,
  });
  const doctorSecret = fieldFromHex(doctor.doctor_secret);
  const attestationHash = await poseidon2HashFixed([doctorSecret, claimHash]);

  return {
    icd_code: params.icd_code,
    amount_cents: params.amount_cents,
    visit_date: params.visit_date,
    policy_id: params.policy_id,
    nonce: params.nonce,
    policy_secret: params.policy_secret,
    diagnosis_secret: params.diagnosis_secret,
    random_nonce: params.random_nonce,
    policy_floor_cents: params.policy_floor_cents,
    policy_ceiling_cents: params.policy_ceiling_cents,
    blinding_factor: params.blinding_factor,
    coverage_merkle_root: fieldFromHex(params.policyTree.root),
    policy_commitment: policyCommitment,
    icd_leaf_index: icdLeaf.index,
    icd_merkle_path: icdLeaf.merkle_path.map(fieldFromHex),
    doctor_attestation: {
      doctor_secret: doctorSecret,
      doctor_leaf_index: doctor.index,
      asp_merkle_path: doctor.merkle_path.map(fieldFromHex),
      claim_data_secret: stringToField("unused"),
      attestation_hash: attestationHash,
      asp_merkle_root: fieldFromHex(params.aspTree.root),
      doctor_commitment: fieldFromHex(doctor.doctor_commitment),
    },
    accumulator: params.accumulator,
    billing: params.billing,
    insurer: params.insurer,
    payout_amount: BigInt(params.amount_cents),
  };
}
