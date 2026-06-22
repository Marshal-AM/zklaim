import { MERKLE_DEPTH, MERKLE_LEAF_COUNT, ZERO_FIELD } from "./constants.js";
import { fieldToHex } from "./field.js";
import { initPoseidon2, poseidon2HashFixed } from "./poseidon2.js";

export interface MerkleProof {
  index: number;
  leaf: bigint;
  path: bigint[];
}

export interface MerkleTreeResult {
  depth: number;
  root: bigint;
  leaves: bigint[];
  layers: bigint[][];
}

/** Build fixed-depth binary Merkle tree; pads with ZERO_FIELD leaves */
export async function buildMerkleTree(leaves: bigint[]): Promise<MerkleTreeResult> {
  await initPoseidon2();

  const padded = [...leaves];
  while (padded.length < MERKLE_LEAF_COUNT) {
    padded.push(ZERO_FIELD);
  }
  if (padded.length > MERKLE_LEAF_COUNT) {
    throw new Error(`Too many leaves: ${leaves.length} > ${MERKLE_LEAF_COUNT}`);
  }

  const layers: bigint[][] = [padded];
  let current = padded;

  for (let d = 0; d < MERKLE_DEPTH; d++) {
    const next: bigint[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = current[i + 1];
      next.push(await poseidon2HashFixed([left, right]));
    }
    layers.push(next);
    current = next;
  }

  return {
    depth: MERKLE_DEPTH,
    root: current[0],
    leaves: padded,
    layers,
  };
}

/** Membership proof matching Noir compute_merkle_root bit order */
export function getMembershipProof(
  tree: MerkleTreeResult,
  index: number,
): MerkleProof {
  if (index < 0 || index >= MERKLE_LEAF_COUNT) {
    throw new Error(`Index out of range: ${index}`);
  }

  const path: bigint[] = [];
  let idx = index;
  for (let level = 0; level < MERKLE_DEPTH; level++) {
    const layer = tree.layers[level];
    const siblingIndex = idx ^ 1;
    path.push(layer[siblingIndex] ?? ZERO_FIELD);
    idx >>= 1;
  }

  return {
    index,
    leaf: tree.leaves[index],
    path,
  };
}

/** Recompute root from leaf + path — matches Noir policy/doctor circuits */
export async function verifyMembershipProof(
  leaf: bigint,
  index: number,
  path: bigint[],
  expectedRoot: bigint,
): Promise<boolean> {
  await initPoseidon2();
  if (path.length !== MERKLE_DEPTH) {
    return false;
  }

  let current = leaf;
  for (let i = 0; i < MERKLE_DEPTH; i++) {
    const isRight = (index >> i) & 1;
    const sibling = path[i];
    const [left, right] = isRight === 1 ? [sibling, current] : [current, sibling];
    current = await poseidon2HashFixed([left, right]);
  }

  return current === expectedRoot;
}

export function merkleProofToJson(proof: MerkleProof) {
  return {
    index: proof.index,
    leaf: fieldToHex(proof.leaf),
    merkle_path: proof.path.map(fieldToHex),
  };
}
