use soroban_sdk::{BytesN, Env, Vec};
use zklaim_common::{poseidon2_hash_2, zero_field, MERKLE_DEPTH};

use crate::{CacheKey, DataKey, InstanceKey};

pub fn empty_root(env: &Env) -> BytesN<32> {
    zero_subtree(env, 0)
}

fn leaf_count(env: &Env) -> u32 {
    env.storage()
        .instance()
        .get(&InstanceKey::LeafCount)
        .unwrap_or(0)
}

fn zero_subtree(env: &Env, level: u32) -> BytesN<32> {
    if level == MERKLE_DEPTH {
        return zero_field(env);
    }
    let key = CacheKey::Zero(level);
    if let Some(v) = env.storage().instance().get(&key) {
        return v;
    }
    let child = zero_subtree(env, level + 1);
    let node = poseidon2_hash_2(env, &child, &child);
    env.storage().instance().set(&key, &node);
    node
}

fn leaf_at(env: &Env, index: u32) -> BytesN<32> {
    if index >= leaf_count(env) {
        return zero_field(env);
    }
    env.storage()
        .persistent()
        .get(&DataKey::Leaf(index))
        .unwrap_or_else(|| zero_field(env))
}

fn subtree_hash(env: &Env, level: u32, node_index: u32) -> BytesN<32> {
    if level == MERKLE_DEPTH {
        return leaf_at(env, node_index);
    }

    let count = leaf_count(env);
    let leaves_per_node = 1u32 << (MERKLE_DEPTH - level);
    let start = node_index * leaves_per_node;
    if start >= count {
        return zero_subtree(env, level);
    }

    let left = subtree_hash(env, level + 1, node_index * 2);
    let right = subtree_hash(env, level + 1, node_index * 2 + 1);
    poseidon2_hash_2(env, &left, &right)
}

pub fn append_leaf(env: &Env, leaf: &BytesN<32>, index: u32) -> BytesN<32> {
    let mut node = leaf.clone();
    let mut idx = index;
    for level in 0..MERKLE_DEPTH {
        let empty = zero_subtree(env, MERKLE_DEPTH - level);
        if idx & 1 == 0 {
            env.storage()
                .instance()
                .set(&CacheKey::Frontier(level), &node);
            node = poseidon2_hash_2(env, &node, &empty);
        } else {
            let left: BytesN<32> = env
                .storage()
                .instance()
                .get(&CacheKey::Frontier(level))
                .unwrap_or(empty);
            node = poseidon2_hash_2(env, &left, &node);
        }
        idx >>= 1;
    }
    node
}

pub fn get_merkle_path(env: &Env, index: u32) -> Vec<BytesN<32>> {
    if index >= leaf_count(env) {
        panic!("index out of range");
    }
    let mut path = Vec::new(env);
    for level in 0..MERKLE_DEPTH {
        let sibling_index = (index >> level) ^ 1;
        let tree_level = MERKLE_DEPTH - level;
        path.push_back(subtree_hash(env, tree_level, sibling_index));
    }
    path
}
