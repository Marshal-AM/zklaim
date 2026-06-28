#![cfg(test)]

use soroban_sdk::{contract, contractimpl, testutils::Address as _, Address, BytesN, Env};

use crate::{PassportRegistry, PassportRegistryClient};

#[contract]
struct MockEscrow;

#[contractimpl]
impl MockEscrow {
    pub fn nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        env.storage()
            .instance()
            .get(&nullifier)
            .unwrap_or(false)
    }

    pub fn mark_spent(env: Env, nullifier: BytesN<32>) {
        env.storage().instance().set(&nullifier, &true);
    }
}

#[test]
fn test_append_leaf_requires_spent_nullifier() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let patient = Address::generate(&env);
    let escrow_id = env.register(MockEscrow, ());
    let verifier = Address::generate(&env);

    let contract_id = env.register(PassportRegistry, ());
    let client = PassportRegistryClient::new(&env, &contract_id);
    client.init(&admin, &escrow_id, &verifier);

    let nullifier = BytesN::from_array(&env, &[7u8; 32]);
    let leaf = BytesN::from_array(&env, &[3u8; 32]);

    let escrow_client = MockEscrowClient::new(&env, &escrow_id);
    escrow_client.mark_spent(&nullifier);

    let root = client.append_leaf(&patient, &nullifier, &leaf);
    assert_eq!(client.get_leaf_count(&patient), 1);
    assert_eq!(client.get_root(&patient), root);
    assert_eq!(client.get_merkle_path(&patient, &0u32).len(), 8);
}

#[test]
fn test_register_verifier() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let verifier_addr = Address::generate(&env);
    let escrow = Address::generate(&env);
    let ultrahonk = Address::generate(&env);

    let contract_id = env.register(PassportRegistry, ());
    let client = PassportRegistryClient::new(&env, &contract_id);
    client.init(&admin, &escrow, &ultrahonk);

    assert!(!client.is_verifier_registered(&verifier_addr));
    client.register_verifier(&admin, &verifier_addr, &true);
    assert!(client.is_verifier_registered(&verifier_addr));
}
