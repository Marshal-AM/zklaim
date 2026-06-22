#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, BytesN, Env};

use crate::{DeductibleTracker, DeductibleTrackerClient};

#[test]
fn test_deductible_crossing() {
    let env = Env::default();
    env.mock_all_auths();
    let verifier = Address::generate(&env);
    let patient = Address::generate(&env);

    let contract_id = env.register(DeductibleTracker, ());
    let client = DeductibleTrackerClient::new(&env, &contract_id);
    client.init(&verifier);

    let zero = zklaim_common::zero_field(&env);
    assert_eq!(client.get_accumulator(&patient), zero);
}
