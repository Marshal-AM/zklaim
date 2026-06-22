#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contract]
pub struct PolicyRegistry;

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    PolicyRoot(Address),
    PolicyBounds(Address),
    Expiry(Address),
}

#[contractimpl]
impl PolicyRegistry {
    pub fn register_policy(
        env: Env,
        insurer: Address,
        coverage_root: BytesN<32>,
        bounds_hash: BytesN<32>,
        expiry_ledger: u32,
    ) {
        insurer.require_auth();
        env.storage()
            .instance()
            .set(&StorageKey::PolicyRoot(insurer.clone()), &coverage_root);
        env.storage()
            .instance()
            .set(&StorageKey::PolicyBounds(insurer.clone()), &bounds_hash);
        env.storage()
            .instance()
            .set(&StorageKey::Expiry(insurer), &expiry_ledger);
    }

    pub fn get_coverage_root(env: Env, insurer: Address) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&StorageKey::PolicyRoot(insurer))
            .unwrap_or_else(|| panic!("policy not registered"))
    }

    pub fn get_bounds_hash(env: Env, insurer: Address) -> BytesN<32> {
        env.storage()
            .instance()
            .get(&StorageKey::PolicyBounds(insurer))
            .unwrap_or_else(|| panic!("policy not registered"))
    }

    pub fn get_expiry(env: Env, insurer: Address) -> u32 {
        env.storage()
            .instance()
            .get(&StorageKey::Expiry(insurer))
            .unwrap_or(0)
    }

    pub fn is_active(env: Env, insurer: Address) -> bool {
        let expiry = Self::get_expiry(env.clone(), insurer);
        env.ledger().sequence() <= expiry
    }
}
