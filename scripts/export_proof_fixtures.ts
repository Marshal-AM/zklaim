import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BB = join(ROOT, "circuits", "target", "bb");
const OUT = join(ROOT, "contracts", "test_fixtures");

const circuits = [
  "policy_validity",
  "amount_range",
  "doctor_attestation",
  "deductible_accumulator",
];

function readHexField(hex: string): string {
  return hex.replace(/^0x/, "").padStart(64, "0");
}

function parseProverToml(path: string): Record<string, string> {
  const text = readFileSync(path, "utf8");
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const manifest: Record<string, unknown> = { circuits: {} };

for (const circuit of circuits) {
  const proof = readFileSync(join(BB, circuit, "proof"));
  const vk = readFileSync(join(BB, circuit, "vk"));
  const prover = parseProverToml(
    join(ROOT, "circuits", circuit, "Prover.toml"),
  );

  writeFileSync(join(OUT, `${circuit}.proof.bin`), proof);
  writeFileSync(join(OUT, `${circuit}.vk.bin`), vk);

  (manifest.circuits as Record<string, unknown>)[circuit] = {
    proof_path: `contracts/test_fixtures/${circuit}.proof.bin`,
    vk_path: `contracts/test_fixtures/${circuit}.vk.bin`,
    prover_fields: prover,
  };
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log("Wrote contracts/test_fixtures/*");
