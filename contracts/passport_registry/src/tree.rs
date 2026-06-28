use soroban_sdk::{contracttype, Address, BytesN, Env};
use zklaim_common::{poseidon2_hash_2, zero_field};

pub const PASSPORT_MERKLE_DEPTH: u32 = 8;
pub const MAX_PASSPORT_LEAVES: u32 = 1 << PASSPORT_MERKLE_DEPTH;

#[contracttype]
#[derive(Clone)]
pub(crate) enum PatientKey {
    Leaf(Address, u32),
    Frontier(Address, u32),
    Zero(Address, u32),
    Root(Address),
    Count(Address),
}

fn zero_subtree(env: &Env, patient: &Address, level: u32) -> BytesN<32> {
    if level == PASSPORT_MERKLE_DEPTH {
        return zero_field(env);
    }
    let key = PatientKey::Zero(patient.clone(), level);
    if let Some(v) = env.storage().persistent().get(&key) {
        return v;
    }
    let child = zero_subtree(env, patient, level + 1);
    let node = poseidon2_hash_2(env, &child, &child);
    env.storage().persistent().set(&key, &node);
    env.storage()
        .persistent()
        .extend_ttl(&key, 100, 100_000);
    node
}

pub fn leaf_count(env: &Env, patient: &Address) -> u32 {
    let key = PatientKey::Count(patient.clone());
    env.storage().persistent().get(&key).unwrap_or(0)
}

pub fn get_root(env: &Env, patient: &Address) -> BytesN<32> {
    let key = PatientKey::Root(patient.clone());
    env.storage()
        .persistent()
        .get(&key)
        .unwrap_or_else(|| zero_subtree(env, patient, 0))
}

fn leaf_at(env: &Env, patient: &Address, index: u32) -> BytesN<32> {
    if index >= leaf_count(env, patient) {
        return zero_field(env);
    }
    let key = PatientKey::Leaf(patient.clone(), index);
    env.storage().persistent().get(&key).unwrap()
}

fn subtree_hash(env: &Env, patient: &Address, level: u32, node_index: u32) -> BytesN<32> {
    if level == PASSPORT_MERKLE_DEPTH {
        return leaf_at(env, patient, node_index);
    }

    let count = leaf_count(env, patient);
    let leaves_per_node = 1u32 << (PASSPORT_MERKLE_DEPTH - level);
    let start = node_index * leaves_per_node;
    if start >= count {
        return zero_subtree(env, patient, level);
    }

    let left = subtree_hash(env, patient, level + 1, node_index * 2);
    let right = subtree_hash(env, patient, level + 1, node_index * 2 + 1);
    poseidon2_hash_2(env, &left, &right)
}

pub fn append_leaf(
    env: &Env,
    patient: &Address,
    leaf: &BytesN<32>,
    index: u32,
) -> BytesN<32> {
    let mut node = leaf.clone();
    let mut idx = index;
    for level in 0..PASSPORT_MERKLE_DEPTH {
        let empty = zero_subtree(env, patient, PASSPORT_MERKLE_DEPTH - level);
        if idx & 1 == 0 {
            let key = PatientKey::Frontier(patient.clone(), level);
            env.storage().persistent().set(&key, &node);
            env.storage()
                .persistent()
                .extend_ttl(&key, 100, 100_000);
            node = poseidon2_hash_2(env, &node, &empty);
        } else {
            let key = PatientKey::Frontier(patient.clone(), level);
            let left: BytesN<32> = env
                .storage()
                .persistent()
                .get(&key)
                .unwrap_or(empty);
            node = poseidon2_hash_2(env, &left, &node);
        }
        idx >>= 1;
    }
    node
}

pub fn get_merkle_path(env: &Env, patient: &Address, index: u32) -> soroban_sdk::Vec<BytesN<32>> {
    if index >= leaf_count(env, patient) {
        panic!("index out of range");
    }
    let mut path = soroban_sdk::Vec::new(env);
    for level in 0..PASSPORT_MERKLE_DEPTH {
        let sibling_index = (index >> level) ^ 1;
        let tree_level = PASSPORT_MERKLE_DEPTH - level;
        path.push_back(subtree_hash(env, patient, tree_level, sibling_index));
    }
    path
}

pub fn insert_leaf(env: &Env, patient: &Address, leaf: &BytesN<32>) -> (BytesN<32>, u32) {
    let mut count = leaf_count(env, patient);
    if count >= MAX_PASSPORT_LEAVES {
        panic!("passport tree full");
    }
    let leaf_key = PatientKey::Leaf(patient.clone(), count);
    env.storage().persistent().set(&leaf_key, leaf);
    env.storage()
        .persistent()
        .extend_ttl(&leaf_key, 100, 100_000);
    let root = append_leaf(env, patient, leaf, count);
    count += 1;
    let count_key = PatientKey::Count(patient.clone());
    env.storage().persistent().set(&count_key, &count);
    env.storage()
        .persistent()
        .extend_ttl(&count_key, 100, 100_000);
    let root_key = PatientKey::Root(patient.clone());
    env.storage().persistent().set(&root_key, &root);
    env.storage()
        .persistent()
        .extend_ttl(&root_key, 100, 100_000);
    (root, count)
}
