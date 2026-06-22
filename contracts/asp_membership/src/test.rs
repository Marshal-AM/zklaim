#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{AspMembership, AspMembershipClient};

#[test]
fn test_asp_member_check() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let contract_id = env.register(AspMembership, ());
    let client = AspMembershipClient::new(&env, &contract_id);
    client.init(&admin);

    let license = BytesN::from_array(&env, &[1u8; 32]);
    let specialty = BytesN::from_array(&env, &[2u8; 32]);
    let jurisdiction = BytesN::from_array(&env, &[3u8; 32]);
    let leaf = zklaim_common::enroll_doctor_leaf(&env, &license, &specialty, &jurisdiction);

    client.insert_leaf(&admin, &leaf);

    let root = client.get_root();
    let path = client.get_path(&0);
    assert_eq!(client.leaf_count(), 1);
    assert!(client.is_member(&leaf, &0, &path, &root));

    let bad_leaf = BytesN::from_array(&env, &[9u8; 32]);
    assert!(!client.is_member(&bad_leaf, &0, &path, &root));
}
