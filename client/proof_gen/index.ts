import {
  computeClaimHash,
  computeNullifier,
  fieldToBytesBE,
  icdToField,
  initPoseidon2,
  poseidon2HashFixed,
  pedersenCommit,
} from "@zklaim/scripts";
import type {
  ClaimData,
  ClaimPackageOnChain,
  CircuitName,
  CircuitProofResult,
  GenerateClaimProofsOptions,
  ProofPackage,
  WorkerProveMessage,
  WorkerResponse,
} from "./inputs.js";
import { deriveAccumulatorCommits } from "./accumulator.js";
import { resolveFraudProof } from "./fraud.js";
import { buildClaimPackageOnChain } from "./stellar/encoding.js";
import { runProveJob } from "./workers/prove_shared.js";

export { loadDemoClaimData } from "./demo.js";
export { PROOF_BYTES } from "./inputs.js";
export type {
  ClaimData,
  ClaimPackageOnChain,
  CircuitProofResult,
  ProofPackage,
  GenerateClaimProofsOptions,
} from "./inputs.js";
export { buildClaimTransaction } from "./stellar/transaction.js";
export { submitClaim } from "./stellar/submit.js";
export { claimPackageToScVal, buildClaimPackageOnChain } from "./stellar/encoding.js";

const WORKER_URLS: Record<CircuitName, string> = {
  policy_validity: "./workers/policy.worker.ts",
  amount_range: "./workers/amount.worker.ts",
  doctor_attestation: "./workers/doctor.worker.ts",
  deductible_accumulator: "./workers/accum.worker.ts",
};

function runWorker(
  circuit: CircuitName,
  inputs: Record<string, unknown>,
): Promise<CircuitProofResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL(WORKER_URLS[circuit], import.meta.url),
      { type: "module" },
    );
    const msg: WorkerProveMessage = { type: "PROVE", circuit, inputs };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      worker.terminate();
      const data = e.data;
      if (data.type === "PROOF") resolve(data.result);
      else reject(new Error(data.error));
    };
    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };
    worker.postMessage(msg);
  });
}

async function proveWithMode(
  circuit: CircuitName,
  inputs: Record<string, unknown>,
  useWorkers: boolean,
): Promise<CircuitProofResult> {
  if (useWorkers && typeof Worker !== "undefined") {
    return runWorker(circuit, inputs);
  }
  return runProveJob(circuit, inputs);
}

export async function generateClaimProofs(
  claim: ClaimData,
  options: GenerateClaimProofsOptions = {},
): Promise<ProofPackage> {
  const useWorkers = options.useWorkers ?? true;
  await initPoseidon2();

  const claim_hash = await computeClaimHash({
    visitDate: claim.visit_date,
    policyId: claim.policy_id,
    nonce: claim.nonce,
  });

  const icdField = icdToField(claim.icd_code);
  const bounds_hash = await poseidon2HashFixed([
    BigInt(claim.policy_floor_cents),
    BigInt(claim.policy_ceiling_cents),
  ]);
  const amount_commitment = await pedersenCommit(
    BigInt(claim.amount_cents),
    claim.blinding_factor,
  );

  const accumCommits = await deriveAccumulatorCommits(
    claim.accumulator,
    claim.amount_cents,
  );

  const policyInputs = {
    icd_code: icdField,
    icd_leaf_index: claim.icd_leaf_index,
    icd_merkle_path: claim.icd_merkle_path,
    policy_secret: claim.policy_secret,
    coverage_merkle_root: claim.coverage_merkle_root,
    policy_commitment: claim.policy_commitment,
    claim_hash,
  };

  const amountInputs = {
    raw_amount: claim.amount_cents,
    blinding_factor: claim.blinding_factor,
    policy_floor_cents: claim.policy_floor_cents,
    policy_ceiling_cents: claim.policy_ceiling_cents,
    amount_commitment,
    policy_bounds_hash: bounds_hash,
    claim_hash,
  };

  const doctor = claim.doctor_attestation;
  const doctorInputs = {
    doctor_secret: doctor.doctor_secret,
    doctor_leaf_index: doctor.doctor_leaf_index,
    asp_merkle_path: doctor.asp_merkle_path,
    claim_data_secret: doctor.claim_data_secret,
    asp_merkle_root: doctor.asp_merkle_root,
    doctor_commitment: doctor.doctor_commitment,
    claim_hash,
    attestation_hash: doctor.attestation_hash,
  };

  const [policyResult, amountResult, doctorResult] = await Promise.all([
    proveWithMode("policy_validity", policyInputs, useWorkers),
    proveWithMode("amount_range", amountInputs, useWorkers),
    proveWithMode("doctor_attestation", doctorInputs, useWorkers),
  ]);

  const accumInputs = {
    prev_accumulator_secret: claim.accumulator.prev_accumulator_secret,
    new_amount: claim.amount_cents,
    new_amount_blinding: claim.accumulator.blinding_factor,
    deductible_limit: claim.accumulator.deductible_limit_cents,
    prev_accumulator_commit: accumCommits.prev_accumulator_commit,
    new_accumulator_commit: accumCommits.new_accumulator_commit,
    new_amount_commit: accumCommits.new_amount_commit,
    deductible_met: accumCommits.deductible_met,
    claim_hash,
  };

  const accumResult = await proveWithMode(
    "deductible_accumulator",
    accumInputs,
    useWorkers,
  );

  const nullifier = await computeNullifier({
    policyId: claim.policy_id,
    visitDate: claim.visit_date,
    diagnosisSecret: claim.diagnosis_secret,
    randomNonce: claim.random_nonce,
  });

  const fraud = await resolveFraudProof(claim);

  return {
    policyResult,
    amountResult,
    doctorResult,
    accumResult,
    claim_hash,
    nullifier,
    fraud,
    insurer: claim.insurer,
    payout_amount: claim.payout_amount,
  };
}

export function buildClaimPackage(pkg: ProofPackage): ClaimPackageOnChain {
  return buildClaimPackageOnChain(pkg);
}
