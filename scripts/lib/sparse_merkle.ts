import { SPARSE_MERKLE_DEPTH, ZERO_FIELD } from "./constants.js";
import { fieldToBytesBE, fieldToHex, bytesBEToField } from "./field.js";
import { initPoseidon2, poseidon2HashFixed } from "./poseidon2.js";

export interface SparseNonMembershipProof {
  key: bigint;
  root: bigint;
  path: bigint[];
  pathIndices: number[];
}

/** Matches contracts/asp_nonmembership sparse_merkle.rs */
export class SparseMerkleTree {
  private leafMap = new Map<number, bigint>();
  private nodeCache = new Map<string, bigint>();
  private defaults: bigint[] = [];
  private root: bigint = ZERO_FIELD;

  constructor(private depth: number = SPARSE_MERKLE_DEPTH) {}

  async init(): Promise<void> {
    await initPoseidon2();
    this.defaults = new Array(this.depth + 1);
    this.defaults[this.depth] = ZERO_FIELD;
    for (let d = this.depth - 1; d >= 0; d--) {
      const child = this.defaults[d + 1]!;
      this.defaults[d] = await poseidon2HashFixed([child, child]);
    }
    this.root = this.defaults[0]!;
  }

  getDepth(): number {
    return this.depth;
  }

  /** Last 4 bytes BE masked — same as sparse_merkle::key_to_index */
  private keyToIndex(key: bigint): number {
    const bytes = fieldToBytesBE(key);
    const low =
      (bytes[28]! << 24) |
      (bytes[29]! << 16) |
      (bytes[30]! << 8) |
      bytes[31]!;
    return low & ((1 << this.depth) - 1);
  }

  /** poseidon2_hash_2(pattern, poseidon2_hash_1([1u8; 32])) — Rust [1u8; 32] is 32 bytes of 1 */
  private async patternLeaf(key: bigint): Promise<bigint> {
    const oneBytes = new Uint8Array(32).fill(1);
    const hashedOne = await poseidon2HashFixed([bytesBEToField(oneBytes)]);
    return poseidon2HashFixed([key, hashedOne]);
  }

  private async hashAtLevel(level: number, index: number): Promise<bigint> {
    if (level === this.depth) {
      return this.leafMap.get(index) ?? this.defaults[this.depth]!;
    }
    const cached = this.nodeCache.get(`${level}-${index}`);
    if (cached !== undefined) {
      return cached;
    }
    return this.defaults[level]!;
  }

  async insert(key: bigint): Promise<void> {
    const leaf = await this.patternLeaf(key);
    const index = this.keyToIndex(key);
    this.leafMap.set(index, leaf);

    let node = leaf;
    let idx = index;
    for (let level = this.depth; level >= 1; level--) {
      const siblingIndex = idx ^ 1;
      const sibling = await this.hashAtLevel(level, siblingIndex);
      node =
        (idx & 1) === 1
          ? await poseidon2HashFixed([sibling, node])
          : await poseidon2HashFixed([node, sibling]);
      idx >>= 1;
      this.nodeCache.set(`${level - 1}-${idx}`, node);
    }
    this.root = node;
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

    for (let level = this.depth; level >= 1; level--) {
      const posAtLevel = index >> (this.depth - level);
      const siblingPos = posAtLevel ^ 1;
      path.push(await this.hashAtLevel(level, siblingPos));
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

    let current = this.defaults[this.depth]!;

    for (let i = 0; i < proof.path.length; i++) {
      const sibling = proof.path[i]!;
      const isRight = proof.pathIndices[i]!;
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
