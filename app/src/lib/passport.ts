import {
  fieldFromHex,
  fieldToBytesBE,
  fieldToHex,
  initPoseidon2,
  poseidon2HashFixed,
  stringToField,
} from "@zklaim/scripts";

export const PASSPORT_MERKLE_DEPTH = 8;
export const PASSPORT_MAX_LEAVES = 32;

export interface ClaimLeafInputs {
  nullifier: Uint8Array;
  leaf_secret: bigint;
  icd_category: string;
  amount_bucket: number;
  visit_month: number;
}

export interface LocalLeafRecord {
  leaf_index: number;
  leaf_secret: string;
  leaf_commitment: string;
  merkle_path: string[];
  icd_category: string;
  amount_bucket: number;
  visit_month: number;
  claim_date: number;
  settled_txid: string;
  nullifier: string;
}

export interface PassportLocalStore {
  version: number;
  patient_pubkey: string;
  leaves: LocalLeafRecord[];
  on_chain_root?: string;
}

export function icdLetterFromCode(icdCode: string): string {
  const normalized = icdCode.trim().toUpperCase();
  if (!normalized) return "Z";
  return normalized[0] ?? "Z";
}

export function icdLetterToField(letter: string): bigint {
  return stringToField(letter.slice(0, 1));
}

/** Spec: floor(amount_cents / 50000) * 50000 */
export function bucketAmountCents(amountCents: number): number {
  const step = 50_000;
  return Math.floor(amountCents / step) * step;
}

export function visitMonthFromDate(visitDate: number): number {
  // Claims use YYYYMMDD (e.g. 20260627); legacy paths may use unix seconds.
  if (visitDate >= 19000101 && visitDate <= 29991231) {
    const y = Math.floor(visitDate / 10000);
    const m = Math.floor((visitDate % 10000) / 100) - 1;
    return y * 12 + m;
  }
  const d = new Date(visitDate * 1000);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

export function formatAmountBucketLabel(bucketCents: number): string {
  const low = bucketCents / 100;
  const high = (bucketCents + 49_999) / 100;
  return `$${low.toFixed(0)}–$${high.toFixed(0)}`;
}

export function randomLeafSecret(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let v = 0n;
  for (const b of bytes) v = (v << 8n) + BigInt(b);
  return v % (2n ** 254n);
}

export async function computeLeafCommitment(
  inputs: ClaimLeafInputs,
): Promise<Uint8Array> {
  await initPoseidon2();
  let nullifierField = 0n;
  for (let i = 0; i < inputs.nullifier.length; i++) {
    nullifierField = (nullifierField << 8n) + BigInt(inputs.nullifier[i]!);
  }
  const hash = await poseidon2HashFixed([
    nullifierField,
    inputs.leaf_secret,
    icdLetterToField(inputs.icd_category),
    BigInt(inputs.amount_bucket),
    BigInt(inputs.visit_month),
  ]);
  return fieldToBytesBE(hash);
}

export async function computeMerkleRootDepth8(
  leaf: bigint,
  index: number,
  path: bigint[],
): Promise<bigint> {
  await initPoseidon2();
  if (path.length !== PASSPORT_MERKLE_DEPTH) {
    throw new Error(`Expected path length ${PASSPORT_MERKLE_DEPTH}`);
  }
  let current = leaf;
  for (let i = 0; i < PASSPORT_MERKLE_DEPTH; i++) {
    const isRight = (index >> i) & 1;
    const sibling = path[i]!;
    current = await poseidon2HashFixed(
      isRight === 1 ? [sibling, current] : [current, sibling],
    );
  }
  return current;
}

export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function scValPathToFields(pathHex: string[]): bigint[] {
  return pathHex.map((h) => fieldFromHex(h));
}

export function leafRecordToCircuitArrays(
  store: PassportLocalStore,
  passportRoot: bigint,
  excludedCategory: string,
) {
  const leaves = store.leaves.slice(0, PASSPORT_MAX_LEAVES);
  const activeCount = leaves.length;

  const leaf_nullifiers: string[] = [];
  const leaf_secrets: string[] = [];
  const leaf_categories: string[] = [];
  const leaf_amount_bkts: string[] = [];
  const leaf_months: string[] = [];
  const merkle_paths: string[][] = [];
  const leaf_active: boolean[] = [];

  for (let i = 0; i < PASSPORT_MAX_LEAVES; i++) {
    const leaf = leaves[i];
    if (leaf) {
      leaf_active.push(true);
      leaf_nullifiers.push(leaf.nullifier);
      leaf_secrets.push(leaf.leaf_secret);
      leaf_categories.push(fieldToHex(icdLetterToField(leaf.icd_category)));
      leaf_amount_bkts.push(fieldToHex(BigInt(leaf.amount_bucket)));
      leaf_months.push(fieldToHex(BigInt(leaf.visit_month)));
      merkle_paths.push(leaf.merkle_path);
    } else {
      leaf_active.push(false);
      leaf_nullifiers.push(fieldToHex(0n));
      leaf_secrets.push(fieldToHex(0n));
      leaf_categories.push(fieldToHex(0n));
      leaf_amount_bkts.push(fieldToHex(0n));
      leaf_months.push(fieldToHex(0n));
      merkle_paths.push(Array(PASSPORT_MERKLE_DEPTH).fill(fieldToHex(0n)));
    }
  }

  return {
    passport_root: fieldToHex(passportRoot),
    excluded_category: fieldToHex(icdLetterToField(excludedCategory)),
    claim_count: activeCount,
    leaf_nullifiers,
    leaf_secrets,
    leaf_categories,
    leaf_amount_bkts,
    leaf_months,
    merkle_paths,
    leaf_active,
  };
}

export function uniqueCategories(store: PassportLocalStore): string[] {
  const set = new Set(store.leaves.map((l) => l.icd_category));
  return [...set].sort();
}
