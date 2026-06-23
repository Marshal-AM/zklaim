import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Noir } from "@noir-lang/noir_js";
import type { CompiledCircuit, InputMap } from "@noir-lang/types";
import { UltraHonkBackend } from "@aztec/bb.js";
import { fieldFromHex, fieldToBytesBE, fieldToHex } from "@zklaim/scripts";
import type { CircuitName, CircuitProofResult } from "./inputs.js";
import { PROOF_BYTES } from "./inputs.js";
import { boolToField } from "./accumulator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = join(__dirname, "..", "wasm");

const circuitCache = new Map<CircuitName, CompiledCircuit>();

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

export function loadCircuit(name: CircuitName): CompiledCircuit {
  const cached = circuitCache.get(name);
  if (cached) return cached;

  const path = join(WASM_DIR, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path} — run npm run build:circuits in WSL first`,
    );
  }
  const circuit = JSON.parse(readFileSync(path, "utf8")) as CompiledCircuit;
  if (!circuit.noir_version?.startsWith("1.0.0-beta.3")) {
    throw new Error(
      `Unexpected noir_version for ${name}: ${circuit.noir_version}`,
    );
  }
  circuitCache.set(name, circuit);
  return circuit;
}

export async function proveCircuit(
  name: CircuitName,
  inputs: InputMap,
): Promise<CircuitProofResult> {
  const circuit = loadCircuit(name);
  const noir = new Noir(circuit);
  await noir.init();
  const { witness } = await noir.execute(inputs);

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
