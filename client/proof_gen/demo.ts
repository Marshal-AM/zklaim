import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { fieldFromHex } from "@zklaim/scripts";
import type { ClaimData } from "./inputs.js";
import { hydrateClaimData } from "./hydrate.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const ARTIFACTS = join(ROOT, "scripts", "artifacts");
const SEED = join(ROOT, "scripts", "seed");

function requireArtifact(path: string): string {
  if (!existsSync(path)) {
    throw new Error(
      `Missing ${path} — run npm run build:trees first`,
    );
  }
  return readFileSync(path, "utf8");
}

export async function loadDemoClaimData(): Promise<ClaimData> {
  const demo = JSON.parse(requireArtifact(join(SEED, "demo_claim.json")));
  const policyTree = JSON.parse(requireArtifact(join(ARTIFACTS, "policy_tree.json")));
  const aspTree = JSON.parse(requireArtifact(join(ARTIFACTS, "asp_tree.json")));

  return hydrateClaimData({
    icd_code: demo.demo_a.icd_code,
    amount_cents: demo.demo_a.raw_amount_cents,
    visit_date: demo.visit_date,
    policy_id: demo.policy_id,
    nonce: fieldFromHex(demo.nonce),
    policy_secret: fieldFromHex(demo.policy_secret),
    diagnosis_secret: fieldFromHex(demo.diagnosis_secret),
    random_nonce: fieldFromHex(demo.random_nonce),
    policy_floor_cents: demo.demo_a.policy_floor_cents,
    policy_ceiling_cents: demo.demo_a.policy_ceiling_cents,
    blinding_factor: fieldFromHex(demo.demo_a.blinding_factor),
    accumulator: {
      prev_accumulator_secret: BigInt(demo.demo_b.prev_accumulator_secret),
      deductible_limit_cents: demo.demo_b.deductible_limit_cents,
      blinding_factor: fieldFromHex(demo.demo_a.blinding_factor),
      prior_claim_amount: 0,
      prior_claim_blinding: 0n,
    },
    billing: {
      amount_bucket_min: 100,
      amount_bucket_max: 50000,
      provider_pattern: "LICENSED",
    },
    insurer:
      process.env.INSURER_FUND_ADDRESS ??
      process.env.DEPLOYER_PUBLIC_KEY ??
      "",
    doctor_license_id: "MD-001",
    policyTree,
    aspTree,
  });
}
