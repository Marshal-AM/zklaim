import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CompiledCircuit } from "@noir-lang/types";
import type { CircuitName } from "./inputs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR_CANDIDATES = [
  join(__dirname, "..", "wasm"),
  join(__dirname, "..", "..", "wasm"),
];

export function loadCircuitFromFs(name: CircuitName): CompiledCircuit {
  const path = WASM_DIR_CANDIDATES.map((dir) => join(dir, `${name}.json`)).find(
    (p) => existsSync(p),
  );
  if (!path) {
    throw new Error(
      `Missing ${name}.json — run npm run build:circuits in WSL first`,
    );
  }
  const circuit = JSON.parse(readFileSync(path, "utf8")) as CompiledCircuit & {
    noir_version?: string;
  };
  if (!circuit.noir_version?.startsWith("1.0.0-beta.3")) {
    throw new Error(
      `Unexpected noir_version for ${name}: ${circuit.noir_version}`,
    );
  }
  return circuit;
}
