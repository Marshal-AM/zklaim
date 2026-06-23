import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeClaimHash,
  computeNullifier,
  fieldFromHex,
  icdToField,
  initPoseidon2,
  poseidon2HashFixed,
  stringToField,
} from "@zklaim/scripts";
import type { ClaimData } from "./inputs.js";

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
  const policyTree = JSON.parse(requireArtifact(join(ARTIFACTS, "policy_tree.json"))) as {
    root: string;
    leaves: Array<{
      icd_code: string;
      index: number;
      merkle_path: string[];
    }>;
  };
  const aspTree = JSON.parse(requireArtifact(join(ARTIFACTS, "asp_tree.json"))) as {
    root: string;
    doctors: Array<{
      license_id: string;
      doctor_secret: string;
      doctor_commitment: string;
      index: number;
      merkle_path: string[];
    }>;
  };

  await initPoseidon2();

  const icdLeaf = policyTree.leaves.find((l) => l.icd_code === demo.demo_a.icd_code);
  if (!icdLeaf) throw new Error(`${demo.demo_a.icd_code} not in policy tree`);

  const doctor = aspTree.doctors.find((d) => d.license_id === "MD-001");
  if (!doctor) throw new Error("MD-001 not in ASP tree");

  const policySecret = fieldFromHex(demo.policy_secret);
  const icdField = icdToField(icdLeaf.icd_code);
  const policyCommitment = await poseidon2HashFixed([icdField, policySecret]);
  const nonce = fieldFromHex(demo.nonce);
  const claimHash = await computeClaimHash({
    visitDate: demo.visit_date,
    policyId: demo.policy_id,
    nonce,
  });
  const doctorSecret = fieldFromHex(doctor.doctor_secret);
  const attestationHash = await poseidon2HashFixed([doctorSecret, claimHash]);
  const blinding = fieldFromHex(demo.demo_a.blinding_factor);

  return {
    icd_code: demo.demo_a.icd_code,
    amount_cents: demo.demo_a.raw_amount_cents,
    visit_date: demo.visit_date,
    policy_id: demo.policy_id,
    nonce,
    policy_secret: policySecret,
    diagnosis_secret: fieldFromHex(demo.diagnosis_secret),
    random_nonce: fieldFromHex(demo.random_nonce),
    policy_floor_cents: demo.demo_a.policy_floor_cents,
    policy_ceiling_cents: demo.demo_a.policy_ceiling_cents,
    blinding_factor: blinding,
    coverage_merkle_root: fieldFromHex(policyTree.root),
    policy_commitment: policyCommitment,
    icd_leaf_index: icdLeaf.index,
    icd_merkle_path: icdLeaf.merkle_path.map(fieldFromHex),
    doctor_attestation: {
      doctor_secret: doctorSecret,
      doctor_leaf_index: doctor.index,
      asp_merkle_path: doctor.merkle_path.map(fieldFromHex),
      claim_data_secret: stringToField("unused"),
      attestation_hash: attestationHash,
      asp_merkle_root: fieldFromHex(aspTree.root),
      doctor_commitment: fieldFromHex(doctor.doctor_commitment),
    },
    accumulator: {
      prev_accumulator_secret: BigInt(demo.demo_b.prev_accumulator_secret),
      deductible_limit_cents: demo.demo_b.deductible_limit_cents,
      blinding_factor: blinding,
    },
    billing: {
      amount_bucket_min: 10000,
      amount_bucket_max: 200000,
      provider_pattern: "LICENSED",
    },
    insurer: process.env.INSURER_FUND_ADDRESS ?? process.env.DEPLOYER_PUBLIC_KEY ?? "",
    payout_amount: BigInt(demo.demo_a.raw_amount_cents),
  };
}
