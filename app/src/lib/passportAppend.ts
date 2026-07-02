import { fieldFromHex, fieldToHex } from "@zklaim/scripts";
import type { ClaimTokenPayload } from "./claimToken";
import {
  bucketAmountCents,
  bytesToHex,
  computeLeafCommitment,
  icdLetterFromCode,
  randomLeafSecret,
  visitMonthFromDate,
  type LocalLeafRecord,
} from "./passport";
import {
  appendLocalLeaf,
  ensurePassportStore,
  findLeafByNullifier,
} from "./passportStore";
import {
  appendPassportLeaf,
  fetchPassportMerklePath,
  isPassportConfigured,
  readPassportLeafCount,
  readPassportRoot,
} from "./passportContract";

export interface SettlementPassportInput {
  patientAddress: string;
  nullifierHex: string;
  txHash: string;
  payload: ClaimTokenPayload;
}

export async function buildLeafRecordFromSettlement(
  input: SettlementPassportInput,
): Promise<LocalLeafRecord> {
  const leafSecret = randomLeafSecret();
  const nullifierBytes = hexToBytesSafe(input.nullifierHex);
  const commitment = await computeLeafCommitment({
    nullifier: nullifierBytes,
    leaf_secret: leafSecret,
    icd_category: icdLetterFromCode(input.payload.icd_code),
    amount_bucket: bucketAmountCents(input.payload.amount_cents),
    visit_month: visitMonthFromDate(input.payload.visit_date),
  });

  return {
    leaf_index: -1,
    leaf_secret: fieldToHex(leafSecret),
    leaf_commitment: bytesToHex(commitment),
    merkle_path: [],
    icd_category: icdLetterFromCode(input.payload.icd_code),
    amount_bucket: bucketAmountCents(input.payload.amount_cents),
    visit_month: visitMonthFromDate(input.payload.visit_date),
    claim_date: input.payload.visit_date,
    settled_txid: input.txHash,
    nullifier: input.nullifierHex,
  };
}

function hexToBytesSafe(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/i, "");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function appendSettlementToPassport(
  input: SettlementPassportInput,
): Promise<LocalLeafRecord> {
  if (!isPassportConfigured()) {
    throw new Error("Passport registry contract is not configured");
  }

  await ensurePassportStore(input.patientAddress);
  const store = await ensurePassportStore(input.patientAddress);

  const existing = findLeafByNullifier(store, input.nullifierHex);
  if (existing) return existing;

  const draft = await buildLeafRecordFromSettlement(input);

  await appendPassportLeaf({
    patient: input.patientAddress,
    nullifierHex: input.nullifierHex,
    leafCommitmentHex: draft.leaf_commitment,
  });

  const leafIndex = (await readPassportLeafCount(input.patientAddress)) - 1;
  const pathHex = await fetchPassportMerklePath(
    input.patientAddress,
    leafIndex,
  );
  const rootHex = await readPassportRoot(input.patientAddress);

  const record: LocalLeafRecord = {
    ...draft,
    leaf_index: leafIndex,
    merkle_path: pathHex,
  };

  await appendLocalLeaf(input.patientAddress, record, rootHex);
  return record;
}

export function passportRootToBigint(rootHex: string): bigint {
  return fieldFromHex(rootHex.startsWith("0x") ? rootHex : `0x${rootHex}`);
}
