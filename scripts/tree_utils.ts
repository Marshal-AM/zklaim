import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  initPoseidon2,
  poseidon2HashFixed,
  fieldToHex,
  buildMerkleTree,
  getMembershipProof,
  verifyMembershipProof,
  icdToField,
  computePolicyLeaf,
  stringToField,
  computeDoctorSecret,
  computeDoctorLeaf,
  SparseMerkleTree,
  billingPatternHash,
  icdCategoryToField,
  amountBucketToField,
  providerPatternToField,
} from "./lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(__dirname, "artifacts");
const SEED = join(__dirname, "seed");

interface CoveredRange {
  min_code: string;
  max_code: string;
  category_label: string;
}

/** Demo ICD subset — not full ICD-10 corpus */
const EXPLICIT_DEMO_CODES = [
  "J18.9",
  "J18.0",
  "J06.9",
  "J44.0",
  "J45.909",
  "J00",
  "J20.9",
  "F32.9",
  "F41.1",
  "F33.0",
  "F01",
  "F20.9",
  "C34.90",
  "C50.911",
  "C18.9",
  "C25.9",
];

function parseIcdPrefix(code: string): { letter: string; num: number } {
  const m = code.toUpperCase().match(/^([A-Z])(\d+)/);
  if (!m) throw new Error(`Invalid ICD: ${code}`);
  return { letter: m[1], num: parseInt(m[2], 10) };
}

function codeInRange(code: string, min: string, max: string): boolean {
  const c = parseIcdPrefix(code);
  const lo = parseIcdPrefix(min);
  const hi = parseIcdPrefix(max);
  if (c.letter !== lo.letter || c.letter !== hi.letter) return false;
  return c.num >= lo.num && c.num <= hi.num;
}

export function expandIcdCodes(ranges: CoveredRange[]): string[] {
  const codes = new Set<string>(EXPLICIT_DEMO_CODES);
  for (const range of ranges) {
    for (const code of EXPLICIT_DEMO_CODES) {
      if (codeInRange(code, range.min_code, range.max_code)) {
        codes.add(code);
      }
    }
  }
  return [...codes].sort();
}

export async function buildPolicyTreeArtifact() {
  const ranges: CoveredRange[] = JSON.parse(
    readFileSync(join(SEED, "covered_ranges.json"), "utf8"),
  );
  const icdCodes = expandIcdCodes(ranges);

  await initPoseidon2();

  const leafEntries: {
    icd_code: string;
    icd_code_field: string;
    leaf: string;
    index: number;
  }[] = [];

  const leaves: bigint[] = [];
  for (const code of icdCodes) {
    const field = icdToField(code);
    const leaf = await computePolicyLeaf(field);
    leafEntries.push({
      icd_code: code,
      icd_code_field: fieldToHex(field),
      leaf: fieldToHex(leaf),
      index: leaves.length,
    });
    leaves.push(leaf);
  }

  const tree = await buildMerkleTree(leaves);
  const leavesWithProofs = leafEntries.map((entry) => {
    const proof = getMembershipProof(tree, entry.index);
    return {
      ...entry,
      merkle_path: proof.path.map(fieldToHex),
    };
  });

  return {
    version: 1,
    depth: tree.depth,
    hash: "poseidon2",
    root: fieldToHex(tree.root),
    leaf_count: icdCodes.length,
    leaves: leavesWithProofs,
  };
}

interface PhysicianSeed {
  enrolled: Array<{
    wallet_address: string;
    license_id: string;
    specialty_code: string;
    jurisdiction: string;
  }>;
  unenrolled: {
    wallet_address: string;
    license_id: string;
    specialty_code: string;
    jurisdiction: string;
  };
}

export async function buildAspTreeArtifact() {
  const seed: PhysicianSeed = JSON.parse(
    readFileSync(join(SEED, "physicians.json"), "utf8"),
  );

  await initPoseidon2();

  const doctors: {
    wallet_address: string;
    license_id: string;
    specialty_code: string;
    jurisdiction: string;
    doctor_secret: string;
    doctor_commitment: string;
    leaf: string;
    index: number;
    merkle_path: string[];
  }[] = [];

  const leaves: bigint[] = [];

  for (const doc of seed.enrolled) {
    const licenseHash = stringToField(doc.license_id);
    const specialtyField = stringToField(doc.specialty_code);
    const jurisdictionHash = stringToField(doc.jurisdiction);
    const doctorSecret = await computeDoctorSecret(
      licenseHash,
      specialtyField,
      jurisdictionHash,
    );
    const leaf = await computeDoctorLeaf(doctorSecret);
    const index = leaves.length;
    leaves.push(leaf);
    doctors.push({
      wallet_address: doc.wallet_address,
      license_id: doc.license_id,
      specialty_code: doc.specialty_code,
      jurisdiction: doc.jurisdiction,
      doctor_secret: fieldToHex(doctorSecret),
      doctor_commitment: fieldToHex(leaf),
      leaf: fieldToHex(leaf),
      index,
      merkle_path: [],
    });
  }

  const tree = await buildMerkleTree(leaves);
  for (const doc of doctors) {
    const proof = getMembershipProof(tree, doc.index);
    doc.merkle_path = proof.path.map(fieldToHex);
  }

  return {
    version: 1,
    depth: tree.depth,
    hash: "poseidon2",
    root: fieldToHex(tree.root),
    enrolled_count: doctors.length,
    unenrolled_wallet: seed.unenrolled.wallet_address,
    doctors,
  };
}

interface FraudEntry {
  icd_code: string;
  billing_amount_range: [number, number];
  provider_pattern: string;
  description?: string;
}

export async function buildFraudTreeArtifact() {
  const blacklist: FraudEntry[] = JSON.parse(
    readFileSync(join(SEED, "fraud_blacklist.json"), "utf8"),
  );

  await initPoseidon2();
  const tree = new SparseMerkleTree();
  await tree.init();

  const entries: {
    icd_code: string;
    billing_amount_range: [number, number];
    provider_pattern: string;
    billing_pattern_hash: string;
  }[] = [];

  for (const item of blacklist) {
    const patternHash = await billingPatternHash(
      icdCategoryToField(item.icd_code),
      amountBucketToField(item.billing_amount_range[0], item.billing_amount_range[1]),
      providerPatternToField(item.provider_pattern),
    );
    await tree.insert(patternHash);
    entries.push({
      icd_code: item.icd_code,
      billing_amount_range: item.billing_amount_range,
      provider_pattern: item.provider_pattern,
      billing_pattern_hash: fieldToHex(patternHash),
    });
  }

  const cleanPattern = await billingPatternHash(
    icdCategoryToField("J18.9"),
    amountBucketToField(10000, 200000),
    providerPatternToField("LICENSED"),
  );
  const cleanProof = await tree.getNonMembershipProof(cleanPattern);

  return {
    version: 1,
    depth: tree.getDepth(),
    hash: "poseidon2",
    root: fieldToHex(tree.getRoot()),
    leaves: entries,
    clean_pattern: {
      billing_pattern_hash: fieldToHex(cleanPattern),
      non_membership_proof: {
        path: cleanProof.path.map(fieldToHex),
        path_indices: cleanProof.pathIndices,
      },
    },
  };
}

export { verifyMembershipProof, ARTIFACTS, SEED };
