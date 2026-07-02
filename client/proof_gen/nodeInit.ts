import { setCircuitLoader } from "./circuits.js";
import { loadCircuitFromFs } from "./circuits_node.js";
import { setFraudTreeJson } from "./fraud.js";
import { loadFraudTreeFromFs } from "./fraud_node.js";

let initialized = false;

/** Register filesystem artifact loaders for Node scripts and vitest. */
export function ensureNodeProofGenInitialized(): void {
  if (initialized) return;
  setCircuitLoader(async (name) => loadCircuitFromFs(name));
  setFraudTreeJson(loadFraudTreeFromFs());
  initialized = true;
}
