use soroban_sdk::{BytesN, Env, Vec};
use zklaim_common::{poseidon2_hash_1, poseidon2_hash_2, zero_field};

use crate::{CacheKey, DataKey};

pub const SPARSE_DEPTH: u32 = 16;

pub fn key_to_index(key: &BytesN<32>) -> u32 {
    let arr = key.to_array();
    let low = u32::from_be_bytes([arr[28], arr[29], arr[30], arr[31]]);
    low & ((1u32 << SPARSE_DEPTH) - 1)
}

pub fn pattern_leaf(env: &Env, pattern: &BytesN<32>) -> BytesN<32> {
    poseidon2_hash_2(env, pattern, &poseidon2_hash_1(env, &BytesN::from_array(env, &[1u8; 32])))
}

pub fn default_hash(env: &Env, level: u32) -> BytesN<32> {
    if level == SPARSE_DEPTH {
        return zero_field(env);
    }
    let key = CacheKey::Default(level);
    if let Some(v) = env.storage().instance().get(&key) {
        return v;
    }
    let child = default_hash(env, level + 1);
    let node = poseidon2_hash_2(env, &child, &child);
    env.storage().instance().set(&key, &node);
    node
}

pub fn empty_root(env: &Env) -> BytesN<32> {
    default_hash(env, 0)
}

fn hash_at_level(env: &Env, level: u32, index: u32) -> BytesN<32> {
    if level == SPARSE_DEPTH {
        let key = DataKey::Leaf(index);
        if env.storage().persistent().has(&key) {
            return env.storage().persistent().get(&key).unwrap();
        }
        return default_hash(env, SPARSE_DEPTH);
    }
    env.storage()
        .instance()
        .get(&CacheKey::Node(level, index))
        .unwrap_or_else(|| default_hash(env, level))
}

fn cache_node(env: &Env, level: u32, index: u32, value: &BytesN<32>) {
    env.storage()
        .instance()
        .set(&CacheKey::Node(level, index), value);
}

pub fn insert_leaf(env: &Env, index: u32, leaf: &BytesN<32>) -> BytesN<32> {
    env.storage()
        .persistent()
        .set(&DataKey::Leaf(index), leaf);

    let mut node = leaf.clone();
    let mut idx = index;
    for level in (1..=SPARSE_DEPTH).rev() {
        let sibling_index = idx ^ 1;
        let sibling = hash_at_level(env, level, sibling_index);
        node = if idx & 1 == 1 {
            poseidon2_hash_2(env, &sibling, &node)
        } else {
            poseidon2_hash_2(env, &node, &sibling)
        };
        idx >>= 1;
        cache_node(env, level - 1, idx, &node);
    }
    node
}

pub fn get_non_membership_path(
    env: &Env,
    key: &BytesN<32>,
) -> (Vec<BytesN<32>>, Vec<u32>) {
    let index = key_to_index(key);
    let mut path = Vec::new(env);
    let mut path_indices = Vec::new(env);

    for level in (1..=SPARSE_DEPTH).rev() {
        let pos_at_level = index >> (SPARSE_DEPTH - level);
        let sibling_pos = pos_at_level ^ 1;
        path.push_back(hash_at_level(env, level, sibling_pos));
        path_indices.push_back(pos_at_level & 1);
    }

    (path, path_indices)
}

pub fn verify_non_membership(
    env: &Env,
    _key: &BytesN<32>,
    path: &Vec<BytesN<32>>,
    path_indices: &Vec<u32>,
    root: &BytesN<32>,
) -> bool {
    if path.len() as u32 != SPARSE_DEPTH || path_indices.len() as u32 != SPARSE_DEPTH {
        return false;
    }

    let mut current = default_hash(env, SPARSE_DEPTH);
    for i in 0..SPARSE_DEPTH {
        let sibling = path.get(i).unwrap();
        let is_right = path_indices.get(i).unwrap();
        current = if is_right == 1 {
            poseidon2_hash_2(env, &sibling, &current)
        } else {
            poseidon2_hash_2(env, &current, &sibling)
        };
    }

    current == *root
}
