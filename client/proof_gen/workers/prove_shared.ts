import type { CircuitName, CircuitProofResult } from "../inputs.js";
import {
  proveAccumCircuit,
  proveAmountCircuit,
  proveDoctorCircuit,
  provePolicyCircuit,
} from "../circuits.js";

export type ProveHandler = (
  circuit: CircuitName,
  inputs: Record<string, unknown>,
) => Promise<CircuitProofResult>;

export async function runProveJob(
  circuit: CircuitName,
  inputs: Record<string, unknown>,
): Promise<CircuitProofResult> {
  switch (circuit) {
    case "policy_validity":
      return provePolicyCircuit(inputs as Parameters<typeof provePolicyCircuit>[0]);
    case "amount_range":
      return proveAmountCircuit(inputs as Parameters<typeof proveAmountCircuit>[0]);
    case "doctor_attestation":
      return proveDoctorCircuit(inputs as Parameters<typeof proveDoctorCircuit>[0]);
    case "deductible_accumulator":
      return proveAccumCircuit(inputs as Parameters<typeof proveAccumCircuit>[0]);
    default:
      throw new Error(`Unknown circuit: ${circuit}`);
  }
}
