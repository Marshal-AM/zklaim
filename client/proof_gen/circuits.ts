import type { CompiledCircuit, InputMap } from "@noir-lang/types";
import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import { fieldFromHex, fieldToBytesBE, fieldToHex } from "@zklaim/scripts";
import type { CircuitName, CircuitProofResult } from "./inputs.js";
import { PROOF_BYTES } from "./inputs.js";
import { boolToField } from "./accumulator.js";

const circuitCache = new Map<CircuitName, CompiledCircuit>();
let circuitLoader: ((name: CircuitName) => Promise<CompiledCircuit>) | null =
  null;

export function setCircuitLoader(
  loader: (name: CircuitName) => Promise<CompiledCircuit>,
): void {
  circuitLoader = loader;
}

export async function loadCircuit(name: CircuitName): Promise<CompiledCircuit> {
  const cached = circuitCache.get(name);
  if (cached) return cached;

  let circuit: CompiledCircuit;
  if (circuitLoader) {
    circuit = await circuitLoader(name);
  } else {
    const { loadCircuitFromFetch } = await import("./browserArtifacts.js");
    circuit = await loadCircuitFromFetch(name);
  }
  circuitCache.set(name, circuit);
  return circuit;
}

export function fieldToNoirInput(value: bigint): string {
  return fieldToHex(value);
}

export function encodePublicInputs(fields: bigint[]): Uint8Array[] {
  return fields.map((f) => fieldToBytesBE(f));
}

export function parsePublicInput(value: string): bigint {
  const trimmed = value.trim();
  if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
    return fieldFromHex(trimmed);
  }
  return fieldFromHex(`0x${BigInt(trimmed).toString(16)}`);
}

export async function proveCircuit(
  name: CircuitName,
  inputs: Record<string, unknown>,
): Promise<CircuitProofResult> {
  const circuit = await loadCircuit(name);
  const noir = new Noir(circuit);
  await noir.init();
  const { witness } = await noir.execute(inputs as InputMap);

  const backend = new UltraHonkBackend(circuit.bytecode, { threads: 1 });
  try {
    const { proof, publicInputs } = await backend.generateProof(witness, {
      keccak: true,
    });
    if (proof.length !== PROOF_BYTES) {
      throw new Error(
        `${name}: expected proof ${PROOF_BYTES} bytes, got ${proof.length}`,
      );
    }
    return {
      proof: new Uint8Array(proof),
      publicInputs: publicInputs.map(parsePublicInput),
    };
  } finally {
    await backend.destroy();
  }
}

export async function provePolicyCircuit(args: {
  icd_code: bigint;
  icd_leaf_index: number;
  icd_merkle_path: bigint[];
  policy_secret: bigint;
  coverage_merkle_root: bigint;
  policy_commitment: bigint;
  claim_hash: bigint;
}): Promise<CircuitProofResult> {
  return proveCircuit("policy_validity", {
    icd_code: fieldToNoirInput(args.icd_code),
    icd_leaf_index: String(args.icd_leaf_index),
    icd_merkle_path: args.icd_merkle_path.map(fieldToNoirInput),
    policy_secret: fieldToNoirInput(args.policy_secret),
    coverage_merkle_root: fieldToNoirInput(args.coverage_merkle_root),
    policy_commitment: fieldToNoirInput(args.policy_commitment),
    claim_hash: fieldToNoirInput(args.claim_hash),
  });
}

export async function proveAmountCircuit(args: {
  raw_amount: number;
  blinding_factor: bigint;
  policy_floor_cents: number;
  policy_ceiling_cents: number;
  amount_commitment: bigint;
  policy_bounds_hash: bigint;
  claim_hash: bigint;
}): Promise<CircuitProofResult> {
  return proveCircuit("amount_range", {
    raw_amount: String(args.raw_amount),
    blinding_factor: fieldToNoirInput(args.blinding_factor),
    policy_floor_cents: String(args.policy_floor_cents),
    policy_ceiling_cents: String(args.policy_ceiling_cents),
    amount_commitment: fieldToNoirInput(args.amount_commitment),
    policy_bounds_hash: fieldToNoirInput(args.policy_bounds_hash),
    claim_hash: fieldToNoirInput(args.claim_hash),
  });
}

export async function proveDoctorCircuit(args: {
  doctor_secret: bigint;
  doctor_leaf_index: number;
  asp_merkle_path: bigint[];
  claim_data_secret: bigint;
  asp_merkle_root: bigint;
  doctor_commitment: bigint;
  claim_hash: bigint;
  attestation_hash: bigint;
}): Promise<CircuitProofResult> {
  return proveCircuit("doctor_attestation", {
    doctor_secret: fieldToNoirInput(args.doctor_secret),
    doctor_leaf_index: String(args.doctor_leaf_index),
    asp_merkle_path: args.asp_merkle_path.map(fieldToNoirInput),
    claim_data_secret: fieldToNoirInput(args.claim_data_secret),
    asp_merkle_root: fieldToNoirInput(args.asp_merkle_root),
    doctor_commitment: fieldToNoirInput(args.doctor_commitment),
    claim_hash: fieldToNoirInput(args.claim_hash),
    attestation_hash: fieldToNoirInput(args.attestation_hash),
  });
}

export async function proveAccumCircuit(args: {
  prev_accumulator_secret: bigint;
  prior_claim_amount: number;
  prior_claim_blinding: bigint;
  new_amount: number;
  new_amount_blinding: bigint;
  deductible_limit: number;
  prev_accumulator_commit: bigint;
  new_accumulator_commit: bigint;
  new_amount_commit: bigint;
  deductible_met: boolean;
  claim_hash: bigint;
}): Promise<CircuitProofResult> {
  return proveCircuit("deductible_accumulator", {
    prev_accumulator_secret: fieldToNoirInput(args.prev_accumulator_secret),
    prior_claim_amount: String(args.prior_claim_amount),
    prior_claim_blinding: fieldToNoirInput(args.prior_claim_blinding),
    new_amount: String(args.new_amount),
    new_amount_blinding: fieldToNoirInput(args.new_amount_blinding),
    deductible_limit: String(args.deductible_limit),
    prev_accumulator_commit: fieldToNoirInput(args.prev_accumulator_commit),
    new_accumulator_commit: fieldToNoirInput(args.new_accumulator_commit),
    new_amount_commit: fieldToNoirInput(args.new_amount_commit),
    deductible_met: boolToField(args.deductible_met) === 1n,
    claim_hash: fieldToNoirInput(args.claim_hash),
  });
}

export async function proveCategoryNonMembershipCircuit(args: {
  passport_root: bigint;
  excluded_category: bigint;
  claim_count: number;
  leaf_nullifiers: bigint[];
  leaf_secrets: bigint[];
  leaf_categories: bigint[];
  leaf_amount_bkts: bigint[];
  leaf_months: bigint[];
  merkle_paths: bigint[][];
  leaf_active: boolean[];
}): Promise<CircuitProofResult> {
  const pad = <T>(arr: T[], len: number, fill: T) => {
    const out = [...arr];
    while (out.length < len) out.push(fill);
    return out.slice(0, len);
  };
  const MAX = 32;
  const DEPTH = 8;
  return proveCircuit("category_nonmembership", {
    passport_root: fieldToNoirInput(args.passport_root),
    excluded_category: fieldToNoirInput(args.excluded_category),
    claim_count: String(args.claim_count),
    leaf_nullifiers: pad(args.leaf_nullifiers, MAX, 0n).map(fieldToNoirInput),
    leaf_secrets: pad(args.leaf_secrets, MAX, 0n).map(fieldToNoirInput),
    leaf_categories: pad(args.leaf_categories, MAX, 0n).map(fieldToNoirInput),
    leaf_amount_bkts: pad(args.leaf_amount_bkts, MAX, 0n).map(fieldToNoirInput),
    leaf_months: pad(args.leaf_months, MAX, 0n).map(fieldToNoirInput),
    merkle_paths: pad(args.merkle_paths, MAX, Array(DEPTH).fill(0n)).map((p) =>
      pad(p, DEPTH, 0n).map(fieldToNoirInput),
    ),
    leaf_active: pad(args.leaf_active, MAX, false),
  });
}
