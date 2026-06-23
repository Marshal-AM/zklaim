#![no_std]

mod sparse_merkle;
mod test;

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Vec};

#[contract]
pub struct AspNonmembership;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Leaf(u32),
}

#[contracttype]
#[derive(Clone)]
pub enum CacheKey {
    Default(u32),
    Node(u32, u32),
}

#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    Root,
    LeafCount,
}

#[contractimpl]
impl AspNonmembership {
    pub fn init(env: Env, admin: Address) {
        env.storage().instance().set(&InstanceKey::Admin, &admin);
        env.storage().instance().set(&InstanceKey::LeafCount, &0u32);
        env.storage()
            .instance()
            .set(&InstanceKey::Root, &sparse_merkle::empty_root(&env));
    }

    pub fn insert_pattern(env: Env, admin: Address, billing_pattern_hash: BytesN<32>) {
        Self::require_admin(&env, &admin);
        let index = sparse_merkle::key_to_index(&billing_pattern_hash);
        if env.storage().persistent().has(&DataKey::Leaf(index)) {
            panic!("pattern already inserted");
        }
        let leaf = sparse_merkle::pattern_leaf(&env, &billing_pattern_hash);
        let root = sparse_merkle::insert_leaf(&env, index, &leaf);
        env.storage().instance().set(&InstanceKey::Root, &root);
        let count: u32 = env
            .storage()
            .instance()
            .get(&InstanceKey::LeafCount)
            .unwrap_or(0);
        env.storage()
            .instance()
            .set(&InstanceKey::LeafCount, &(count + 1));
    }

    pub fn get_root(env: Env) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&InstanceKey::Root)
            .unwrap_or_else(|| sparse_merkle::empty_root(&env))
    }

    pub fn contains(env: Env, billing_pattern_hash: BytesN<32>) -> bool {
        let index = sparse_merkle::key_to_index(&billing_pattern_hash);
        env.storage().persistent().has(&DataKey::Leaf(index))
    }

    pub fn get_non_membership_path(
        env: Env,
        billing_pattern_hash: BytesN<32>,
    ) -> (Vec<BytesN<32>>, Vec<u32>) {
        if Self::contains(env.clone(), billing_pattern_hash.clone()) {
            panic!("pattern is a member");
        }
        sparse_merkle::get_non_membership_path(&env, &billing_pattern_hash)
    }

    pub fn verify_non_membership(
        env: Env,
        billing_pattern_hash: BytesN<32>,
        path: Vec<BytesN<32>>,
        path_indices: Vec<u32>,
    ) -> bool {
        let root = Self::get_root(env.clone());
        sparse_merkle::verify_non_membership(
            &env,
            &billing_pattern_hash,
            &path,
            &path_indices,
            &root,
        )
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
