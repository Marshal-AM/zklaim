use soroban_sdk::{BytesN, Env, Vec};

use crate::poseidon2::poseidon2_hash_2;

pub const MERKLE_DEPTH: u32 = 10;

pub fn compute_merkle_root(
    env: &Env,
    leaf: &BytesN<32>,
    index: u64,
    path: &Vec<BytesN<32>>,
) -> BytesN<32> {
    let mut current = leaf.clone();
    for i in 0..MERKLE_DEPTH {
        let sibling = path.get(i).unwrap();
        let is_right = (index >> i) & 1;
        current = if is_right == 1 {
            poseidon2_hash_2(env, &sibling, &current)
        } else {
            poseidon2_hash_2(env, &current, &sibling)
        };
    }
    current
}

pub fn verify_membership(
    env: &Env,
    leaf: &BytesN<32>,
    index: u64,
    path: &Vec<BytesN<32>>,
    root: &BytesN<32>,
) -> bool {
    compute_merkle_root(env, leaf, index, path) == *root
}
