export const PROOF_BYTES = 14592;

export interface DoctorAttestation {
  doctor_secret: bigint;
  doctor_leaf_index: number;
  asp_merkle_path: bigint[];
  claim_data_secret: bigint;
  attestation_hash: bigint;
  asp_merkle_root: bigint;
  doctor_commitment: bigint;
}

export interface AccumulatorState {
  prev_accumulator_secret: bigint;
  deductible_limit_cents: number;
  /** Must match amount circuit blinding_factor */
  blinding_factor: bigint;
}

export interface BillingPattern {
  amount_bucket_min: number;
  amount_bucket_max: number;
  provider_pattern: string;
}

export interface ClaimData {
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
  coverage_merkle_root: bigint;
  policy_commitment: bigint;
  icd_leaf_index: number;
  icd_merkle_path: bigint[];
  doctor_attestation: DoctorAttestation;
  accumulator: AccumulatorState;
  billing: BillingPattern;
  insurer: string;
  payout_amount: bigint;
}

export interface CircuitProofResult {
  proof: Uint8Array;
  publicInputs: bigint[];
}

export interface FraudProofData {
  billing_pattern_hash: bigint;
  fraud_non_membership_proof: Uint8Array[];
  fraud_path_indices: number[];
}

export interface ProofPackage {
  policyResult: CircuitProofResult;
  amountResult: CircuitProofResult;
  doctorResult: CircuitProofResult;
  accumResult: CircuitProofResult;
  claim_hash: bigint;
  nullifier: bigint;
  fraud: FraudProofData;
  insurer: string;
  payout_amount: bigint;
}

/** On-chain ClaimPackage (field elements as 32-byte big-endian) */
export interface ClaimPackageOnChain {
  policy_proof: Uint8Array;
  policy_inputs: Uint8Array[];
  amount_proof: Uint8Array;
  amount_inputs: Uint8Array[];
  doctor_proof: Uint8Array;
  doctor_inputs: Uint8Array[];
  accum_proof: Uint8Array;
  accum_inputs: Uint8Array[];
  fraud_non_membership_proof: Uint8Array[];
  fraud_path_indices: number[];
  nullifier: Uint8Array;
  billing_pattern_hash: Uint8Array;
  insurer: string;
  payout_amount: bigint;
}

export type CircuitName =
  | "policy_validity"
  | "amount_range"
  | "doctor_attestation"
  | "deductible_accumulator"
  | "category_nonmembership";

export type ProofProgressStage =
  | "policy"
  | "amount"
  | "doctor"
  | "accum"
  | "fraud"
  | "nullifier";

export type ProofProgressIndex = 1 | 2 | 3 | 4 | 5 | 6;

export interface GenerateClaimProofsOptions {
  useWorkers?: boolean;
  onProgress?: (stage: ProofProgressStage, index: ProofProgressIndex) => void;
  onCircuitComplete?: (circuit: CircuitName, result: CircuitProofResult) => void;
  fraudTreeJson?: FraudTreeArtifact;
}

export interface FraudTreeArtifact {
  clean_pattern: {
    billing_pattern_hash: string;
    non_membership_proof: {
      path: string[];
      path_indices: number[];
    };
  };
}

export interface WorkerProveMessage {
  type: "PROVE";
  circuit: CircuitName;
  inputs: Record<string, unknown>;
}

export interface WorkerProofMessage {
  type: "PROOF";
  result: CircuitProofResult;
}

export interface WorkerErrorMessage {
  type: "ERROR";
  error: string;
}

export type WorkerResponse = WorkerProofMessage | WorkerErrorMessage;
