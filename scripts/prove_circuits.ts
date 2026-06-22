import { existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const CIRCUITS = join(ROOT, "circuits", "target");

const circuits = [
  "policy_validity",
  "amount_range",
  "doctor_attestation",
  "deductible_accumulator",
];

function run(cmd: string) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

for (const circuit of circuits) {
  const jsonPath = join(CIRCUITS, `${circuit}.json`);
  const witnessPath = join(CIRCUITS, `${circuit}.gz`);

  const out = join(CIRCUITS, "bb", circuit);
  if (!existsSync(out)) mkdirSync(out, { recursive: true });

  console.log(`=== bb prove/verify: ${circuit} ===`);
  run(
    `bb prove -b "${jsonPath}" -w "${witnessPath}" --write_vk -o "${out}" --oracle_hash keccak`,
  );
  run(`bb verify -k "${join(out, "vk")}" -p "${join(out, "proof")}" -i "${join(out, "public_inputs")}" --oracle_hash keccak`);
  console.log(`  OK: ${circuit}`);
}

console.log("=== All bb prove/verify checks passed ===");
