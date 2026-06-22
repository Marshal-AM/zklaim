import { initPoseidon2, poseidon2HashFixed, fieldToHex } from "./lib/index.js";

async function main() {
  await initPoseidon2();

  const hash123 = await poseidon2HashFixed([1n, 2n, 3n]);
  const hash1 = await poseidon2HashFixed([1n]);
  const hashPair12 = await poseidon2HashFixed([1n, 2n]);

  const vectors = {
    hash_1_2_3_len3: fieldToHex(hash123),
    hash_1_len1: fieldToHex(hash1),
    hash_pair_1_2: fieldToHex(hashPair12),
  };

  console.log(JSON.stringify(vectors, null, 2));
}

main().catch(console.error);
