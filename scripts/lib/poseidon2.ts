import { BarretenbergSync } from "@aztec/bb.js";
import {
  RATE,
  STATE_SIZE,
  TWO_POW_64,
} from "./constants.js";
import { fieldToBytesBE, bytesBEToField, modField } from "./field.js";

let bb: BarretenbergSync | null = null;

export async function initPoseidon2(): Promise<void> {
  if (!bb) {
    bb = await BarretenbergSync.initSingleton();
  }
}

export function getPoseidon2(): BarretenbergSync {
  if (!bb) {
    throw new Error("Poseidon2 not initialized — call initPoseidon2() first");
  }
  return bb;
}

/** Barretenberg BN254 Poseidon2 permutation (width 4) — matches Noir foreign fn */
export async function poseidon2Permutation(
  state: bigint[],
): Promise<bigint[]> {
  const api = getPoseidon2();
  if (state.length !== STATE_SIZE) {
    throw new Error(`Poseidon2 state must have length ${STATE_SIZE}`);
  }
  const result = api.poseidon2Permutation({
    inputs: state.map((s) => fieldToBytesBE(s)),
  });
  return result.outputs.map((b) => bytesBEToField(b));
}

class Poseidon2Sponge {
  private state: bigint[] = [0n, 0n, 0n, 0n];
  private cache: bigint[] = [0n, 0n, 0n];
  private cacheSize = 0;
  private squeezeMode = false;

  constructor(iv: bigint) {
    this.state[RATE] = iv;
  }

  private async performDuplex(): Promise<void> {
    for (let i = 0; i < RATE; i++) {
      if (i < this.cacheSize) {
        this.state[i] = modField(this.state[i] + this.cache[i]);
      }
    }
    this.state = await poseidon2Permutation(this.state);
  }

  private async absorb(input: bigint): Promise<void> {
    if (this.squeezeMode) {
      throw new Error("Cannot absorb after squeeze");
    }
    if (this.cacheSize === RATE) {
      await this.performDuplex();
      this.cache[0] = input;
      this.cacheSize = 1;
    } else {
      this.cache[this.cacheSize] = input;
      this.cacheSize += 1;
    }
  }

  private async squeeze(): Promise<bigint> {
    if (this.squeezeMode) {
      throw new Error("Already in squeeze mode");
    }
    await this.performDuplex();
    this.squeezeMode = true;
    return this.state[0];
  }

  /** Mirrors Noir std::hash::poseidon2::Poseidon2::hash_internal */
  static async hashInternal(
    inputs: bigint[],
    inLen: number,
    isVariableLength: boolean,
  ): Promise<bigint> {
    const iv = BigInt(inLen) * TWO_POW_64;
    const sponge = new Poseidon2Sponge(iv);
    for (let i = 0; i < inputs.length; i++) {
      if (i < inLen) {
        await sponge.absorb(inputs[i]);
      }
    }
    if (isVariableLength) {
      await sponge.absorb(1n);
    }
    return sponge.squeeze();
  }
}

/**
 * Noir-compatible Poseidon2 hash.
 * @param inputs Field elements
 * @param messageSize Number of active inputs (in_len)
 */
export async function poseidon2Hash(
  inputs: bigint[],
  messageSize: number,
): Promise<bigint> {
  const isVariableLength = messageSize !== inputs.length;
  return Poseidon2Sponge.hashInternal(inputs, messageSize, isVariableLength);
}

/** Convenience: hash exactly `inputs.length` elements (fixed-length) */
export async function poseidon2HashFixed(
  inputs: bigint[],
): Promise<bigint> {
  return poseidon2Hash(inputs, inputs.length);
}
