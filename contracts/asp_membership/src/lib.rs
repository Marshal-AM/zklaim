#![no_std]

mod test;
mod tree;

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};
use zklaim_common::{enroll_doctor_leaf, verify_membership, MERKLE_DEPTH};

#[contract]
pub struct AspMembership;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Leaf(u32),
}

#[contracttype]
#[derive(Clone)]
pub enum CacheKey {
    Zero(u32),
    Frontier(u32),
}

#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    LeafCount,
    Root,
}

#[contractimpl]
impl AspMembership {
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&InstanceKey::Admin, &admin);
        env.storage().instance().set(&InstanceKey::LeafCount, &0u32);
        env.storage()
            .instance()
            .set(&InstanceKey::Root, &tree::empty_root(&env));
    }

    pub fn enroll_doctor(
        env: Env,
        admin: Address,
        license_hash: BytesN<32>,
        specialty_code: BytesN<32>,
        jurisdiction_hash: BytesN<32>,
    ) {
        Self::require_admin(&env, &admin);
        let leaf = enroll_doctor_leaf(&env, &license_hash, &specialty_code, &jurisdiction_hash);
        Self::insert_leaf_internal(&env, &leaf);
    }

    pub fn insert_leaf(env: Env, admin: Address, commitment: BytesN<32>) {
        Self::require_admin(&env, &admin);
        Self::insert_leaf_internal(&env, &commitment);
    }

    pub fn get_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&InstanceKey::Root)
            .unwrap_or_else(|| tree::empty_root(&env))
    }

    pub fn get_path(env: Env, index: u32) -> Vec<BytesN<32>> {
        tree::get_merkle_path(&env, index)
    }

    pub fn leaf_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&InstanceKey::LeafCount)
            .unwrap_or(0)
    }

    pub fn is_member(
        env: Env,
        leaf: BytesN<32>,
        index: u32,
        path: Vec<BytesN<32>>,
        root: BytesN<32>,
    ) -> bool {
        verify_membership(&env, &leaf, index as u64, &path, &root)
    }

    fn insert_leaf_internal(env: &Env, leaf: &BytesN<32>) {
        let mut count: u32 = env
            .storage()
            .instance()
            .get(&InstanceKey::LeafCount)
            .unwrap_or(0);
        if count >= (1u32 << MERKLE_DEPTH) {
            panic!("tree full");
        }
        env.storage().persistent().set(&DataKey::Leaf(count), leaf);
        count += 1;
        env.storage().instance().set(&InstanceKey::LeafCount, &count);
        let root = tree::append_leaf(env, leaf, count - 1);
        env.storage().instance().set(&InstanceKey::Root, &root);
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::Admin)
            .unwrap_or_else(|| panic!("admin not set"));
        if stored != *admin {
            panic!("unauthorized");
        }
        admin.require_auth();
    }
}
