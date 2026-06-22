#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, Vec};

use crate::{AspNonmembership, AspNonmembershipClient};

fn pattern(env: &Env, v: u8) -> BytesN<32> {
    let mut arr = [0u8; 32];
    arr[31] = v;
    BytesN::from_array(env, &arr)
}

#[test]
fn test_fraud_exclusion() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);

    let contract_id = env.register(AspNonmembership, ());
    let client = AspNonmembershipClient::new(&env, &contract_id);
    client.init(&admin);

    let flagged = pattern(&env, 42);
    client.insert_pattern(&admin, &flagged);
    assert!(client.contains(&flagged));

    let clean = pattern(&env, 7);
    assert!(!client.contains(&clean));

    let (path, indices) = client.get_non_membership_path(&clean);
    assert!(client.verify_non_membership(&clean, &path, &indices));

    let empty_path = Vec::new(&env);
    let empty_indices = Vec::new(&env);
    assert!(!client.verify_non_membership(&flagged, &empty_path, &empty_indices));
}
