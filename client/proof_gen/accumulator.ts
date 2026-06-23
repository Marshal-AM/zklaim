import {
  fieldToBytesBE,
  initPoseidon2,
  pedersenCommit,
  poseidon2HashFixed,
} from "@zklaim/scripts";
import type { AccumulatorState } from "./inputs.js";

export interface AccumulatorCommits {
  prev_accumulator_commit: bigint;
  new_accumulator_commit: bigint;
  new_amount_commit: bigint;
  deductible_met: boolean;
}

export async function deriveAccumulatorCommits(
  accum: AccumulatorState,
  newAmountCents: number,
): Promise<AccumulatorCommits> {
  await initPoseidon2();
  const prev = accum.prev_accumulator_secret;
  const newAmount = BigInt(newAmountCents);
  const prev_accumulator_commit = await poseidon2HashFixed([prev]);
  const new_accumulator_commit = await poseidon2HashFixed([
    prev,
    newAmount,
    accum.blinding_factor,
  ]);
  const new_amount_commit = await pedersenCommit(newAmount, accum.blinding_factor);
  const deductible_met =
    prev + newAmount >= BigInt(accum.deductible_limit_cents);

  return {
    prev_accumulator_commit,
    new_accumulator_commit,
    new_amount_commit,
    deductible_met,
  };
}

/** Encode Noir bool public input for on-chain field_is_true check */
export function boolToFieldBytes(met: boolean): Uint8Array {
  return fieldToBytesBE(met ? 1n : 0n);
}

export function boolToField(met: boolean): bigint {
  return met ? 1n : 0n;
}
