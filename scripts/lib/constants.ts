/** BN254 scalar field — matches Noir Field / Barretenberg Fr */
export const BN254_MODULUS =
  0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001n;

export const MERKLE_DEPTH = 10;
export const MERKLE_LEAF_COUNT = 1 << MERKLE_DEPTH;
export const SPARSE_MERKLE_DEPTH = 16;
export const RATE = 3;
export const STATE_SIZE = 4;
export const TWO_POW_64 = 18446744073709551616n;

/** Padding leaf for unfilled Merkle slots */
export const ZERO_FIELD = 0n;
