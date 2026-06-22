import { SPARSE_MERKLE_DEPTH, ZERO_FIELD } from "./constants.js";
import { fieldToHex, modField } from "./field.js";
import { initPoseidon2, poseidon2HashFixed } from "./poseidon2.js";

export interface SparseNonMembershipProof {
  key: bigint;
  root: bigint;
  path: bigint[];
  pathIndices: number[];
}

export class SparseMerkleTree {
  private leafMap = new Map<number, bigint>();
  private defaults: bigint[] = [];
  private root: bigint = ZERO_FIELD;

  constructor(private depth: number = SPARSE_MERKLE_DEPTH) {}

  async init(): Promise<void> {
    await initPoseidon2();
    this.defaults = new Array(this.depth + 1);
    this.defaults[this.depth] = ZERO_FIELD;
    for (let d = this.depth - 1; d >= 0; d--) {
      const child = this.defaults[d + 1];
      this.defaults[d] = await poseidon2HashFixed([child, child]);
    }
    this.root = this.defaults[0];
  }

  getDepth(): number {
    return this.depth;
  }

  private keyToIndex(key: bigint): number {
    return Number(modField(key) % (1n << BigInt(this.depth)));
  }

  private hasLeafInSubtree(level: number, index: number): boolean {
    const shift = this.depth - level;
    const start = index << shift;
    const end = start + (1 << shift);
    for (const leafIndex of this.leafMap.keys()) {
      if (leafIndex >= start && leafIndex < end) {
        return true;
      }
    }
    return false;
  }

  private async getNode(level: number, index: number): Promise<bigint> {
    if (level === this.depth) {
      return this.leafMap.get(index) ?? this.defaults[this.depth];
    }
    if (!this.hasLeafInSubtree(level, index)) {
      return this.defaults[level];
    }
    const left = await this.getNode(level + 1, index * 2);
    const right = await this.getNode(level + 1, index * 2 + 1);
    return poseidon2HashFixed([left, right]);
  }

  async insert(key: bigint, value: bigint = 1n): Promise<void> {
    const leafHash = await poseidon2HashFixed([key, value]);
    const index = this.keyToIndex(key);
    this.leafMap.set(index, leafHash);
    this.root = await this.getNode(0, 0);
  }

  has(key: bigint): boolean {
    return this.leafMap.has(this.keyToIndex(key));
  }

  getRoot(): bigint {
    return this.root;
  }

  async getNonMembershipProof(key: bigint): Promise<SparseNonMembershipProof> {
    if (this.has(key)) {
      throw new Error("Key is in tree — cannot produce non-membership proof");
    }

    const index = this.keyToIndex(key);
    const path: bigint[] = [];
    const pathIndices: number[] = [];

    for (let level = this.depth; level > 0; level--) {
      const posAtLevel = index >> (this.depth - level);
      const siblingPos = posAtLevel ^ 1;
      path.push(await this.getNode(level, siblingPos));
      pathIndices.push(posAtLevel & 1);
    }

    return {
      key,
      root: this.root,
      path,
      pathIndices,
    };
  }

  async verifyNonMembership(proof: SparseNonMembershipProof): Promise<boolean> {
    if (this.has(proof.key)) {
      return false;
    }

    let current = this.defaults[this.depth];

    for (let i = 0; i < proof.path.length; i++) {
      const sibling = proof.path[i];
      const isRight = proof.pathIndices[i];
      current =
        isRight === 1
          ? await poseidon2HashFixed([sibling, current])
          : await poseidon2HashFixed([current, sibling]);
    }

    return current === proof.root;
  }

  getLeaves(): { key: string; leaf: string }[] {
    return [...this.leafMap.entries()].map(([index, leaf]) => ({
      key: String(index),
      leaf: fieldToHex(leaf),
    }));
  }
}

/** Fraud billing pattern hash per requirements */
export async function billingPatternHash(
  icdCategoryHash: bigint,
  amountBucketHash: bigint,
  providerTypeHash: bigint,
): Promise<bigint> {
  await initPoseidon2();
  return poseidon2HashFixed([
    icdCategoryHash,
    amountBucketHash,
    providerTypeHash,
  ]);
}
