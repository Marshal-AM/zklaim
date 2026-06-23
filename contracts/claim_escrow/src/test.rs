#![cfg(test)]

use soroban_sdk::{testutils::Address as _, token, Address, BytesN, Env};

use crate::{ClaimEscrow, ClaimEscrowClient};

#[test]
fn test_nullifier_double_spend() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let nullifier = BytesN::from_array(&env, &[9u8; 32]);

    let contract_id = env.register(ClaimEscrow, ());
    let client = ClaimEscrowClient::new(&env, &contract_id);

    client.init(
        &admin,
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &2000u32,
    );

    assert!(!client.nullifier_spent(&nullifier));
    env.as_contract(&contract_id, || {
        crate::nullifier::mark_spent(&env, &nullifier);
    });
    assert!(client.nullifier_spent(&nullifier));
}

#[test]
fn test_usdc_settlement() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let patient = Address::generate(&env);
    let insurer = Address::generate(&env);

    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_client = token::StellarAssetClient::new(&env, &sac.address());
    token_client.mint(&insurer, &100_000_000i128);

    let contract_id = env.register(ClaimEscrow, ());
    let client = ClaimEscrowClient::new(&env, &contract_id);
    client.init(
        &admin,
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &Address::generate(&env),
        &sac.address(),
        &insurer,
        &2000u32,
    );

    let payout = client.preview_payout(&100, &true);
    assert_eq!(payout, 100);
    let reduced = client.preview_payout(&100, &false);
    assert_eq!(reduced, 80);

    let escrow = contract_id.clone();
    token::Client::new(&env, &sac.address()).transfer(&insurer, &escrow, &10_000_000i128);
    env.as_contract(&contract_id, || {
        crate::escrow::transfer_usdc(&env, &sac.address(), &patient, payout);
    });

    let balance = token::Client::new(&env, &sac.address()).balance(&patient);
    assert_eq!(balance, crate::escrow::cents_to_stroops(payout));
}
