import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { FraudTreeArtifact } from "./inputs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAUD_ARTIFACT = join(
  __dirname,
  "..",
  "..",
  "scripts",
  "artifacts",
  "fraud_tree.json",
);

export function loadFraudTreeFromFs(): FraudTreeArtifact | null {
  if (!existsSync(FRAUD_ARTIFACT)) return null;
  return JSON.parse(readFileSync(FRAUD_ARTIFACT, "utf8")) as FraudTreeArtifact;
}
