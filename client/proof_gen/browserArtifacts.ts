import type { CompiledCircuit } from "@noir-lang/types";
import type { CircuitName, FraudTreeArtifact } from "./inputs.js";

const EXPECTED_NOIR_VERSION_PREFIX = "1.0.0-beta.3";

export async function loadCircuitFromFetch(
  name: CircuitName,
  baseUrl = "/wasm",
): Promise<CompiledCircuit> {
  const res = await fetch(`${baseUrl}/${name}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${name}.json: ${res.status}`);
  }
  const circuit = (await res.json()) as CompiledCircuit & {
    noir_version?: string;
  };
  if (!circuit.noir_version?.startsWith(EXPECTED_NOIR_VERSION_PREFIX)) {
    throw new Error(
      `Unexpected noir_version for ${name}: ${circuit.noir_version}`,
    );
  }
  return circuit;
}

export function createFetchCircuitLoader(baseUrl = "/wasm") {
  return (name: CircuitName) => loadCircuitFromFetch(name, baseUrl);
}

export async function loadFraudTreeFromFetch(
  baseUrl = "/trees",
): Promise<FraudTreeArtifact> {
  const res = await fetch(`${baseUrl}/fraud_tree.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch fraud_tree.json: ${res.status}`);
  }
  return res.json() as Promise<FraudTreeArtifact>;
}
