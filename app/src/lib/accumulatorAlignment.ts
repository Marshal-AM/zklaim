import { Address } from "@stellar/stellar-sdk";
import { fieldFromHex, fieldToHex, initPoseidon2, poseidon2HashFixed } from "@zklaim/scripts";
import { env } from "../config/env";
import type { ClaimHistoryEntry, InboxClaim } from "../types/patient";
import { readContractRoot } from "./sorobanRead";

const ZERO_ROOT = "0".repeat(64);

export function normalizeCommitHex(value: string): string {
  return value.replace(/^0x/i, "").toLowerCase();
}

export async function readPatientAccumulator(
  patientAddress: string,
): Promise<string> {
  return readContractRoot(
    env.deductibleTrackerId(),
    "get_accumulator",
    [new Address(patientAddress).toScVal()],
  );
}

export function isGenesisAccumulator(commitHex: string): boolean {
  return normalizeCommitHex(commitHex) === ZERO_ROOT;
}

export interface PriorClaimContext {
  amount_cents: number;
  blinding_factor: string;
}

/** Inbox row for the most recent submitted claim (for accumulator chaining). */
export function findPriorSubmittedInboxClaim(
  history: ClaimHistoryEntry[],
  inbox: InboxClaim[],
): InboxClaim | null {
  const submitted = history
    .filter((h) => h.claimId && h.txHash)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  for (const entry of submitted) {
    const inboxClaim = inbox.find((c) => c.id === entry.claimId);
    if (inboxClaim) return inboxClaim;
  }
  return null;
}

export async function computePrevAccumulatorCommit(params: {
  runningTotalBefore: bigint;
  priorClaim?: PriorClaimContext | null;
}): Promise<bigint> {
  await initPoseidon2();
  if (!params.priorClaim) {
    return poseidon2HashFixed([params.runningTotalBefore]);
  }
  const priorAmount = BigInt(params.priorClaim.amount_cents);
  const priorBlinding = fieldFromHex(params.priorClaim.blinding_factor);
  const r0 = params.runningTotalBefore - priorAmount;
  return poseidon2HashFixed([r0, priorAmount, priorBlinding]);
}

export async function assertAccumulatorReadyForClaim(params: {
  patientAddress: string;
  runningTotalBefore: bigint;
  priorClaim?: PriorClaimContext | null;
}): Promise<{ onChainCommit: string; expectedPrevCommit: string }> {
  const onChainCommit = await readPatientAccumulator(params.patientAddress);
  const expected = await computePrevAccumulatorCommit({
    runningTotalBefore: params.runningTotalBefore,
    priorClaim: params.priorClaim,
  });
  const expectedHex = normalizeCommitHex(fieldToHex(expected));

  if (isGenesisAccumulator(onChainCommit)) {
    return { onChainCommit, expectedPrevCommit: expectedHex };
  }

  if (expectedHex !== normalizeCommitHex(onChainCommit)) {
    const priorHint = params.priorClaim
      ? ""
      : " Prior claim secrets were not found in this browser — use the same device/session where you submitted before, or onboard a fresh wallet.";
    throw new Error(
      `Deductible accumulator mismatch for this wallet. On-chain 0x${onChainCommit}, this claim expects 0x${expectedHex}.${priorHint}`,
    );
  }

  return { onChainCommit, expectedPrevCommit: expectedHex };
}
