use soroban_sdk::{Address, Bytes, BytesN, Env};
use crate::types::InstanceKey;
use zklaim_common::COINSURANCE_BPS_DENOM;

pub fn is_spent(env: &Env, nullifier: &BytesN<32>) -> bool {
    use zklaim_common::DataKey;
    env.storage().persistent().has(&DataKey::Nullifier(nullifier.clone()))
}

pub fn mark_spent(env: &Env, nullifier: &BytesN<32>) {
    use zklaim_common::DataKey;
    env.storage()
        .persistent()
        .set(&DataKey::Nullifier(nullifier.clone()), &true);
    env.storage().persistent().extend_ttl(
        &DataKey::Nullifier(nullifier.clone()),
        100,
        100_000,
    );
}

pub fn compute_payout(env: &Env, payout_amount: i128, deductible_met: bool) -> i128 {
    if deductible_met {
        return payout_amount;
    }
    let bps: i128 = env
        .storage()
        .instance()
        .get(&InstanceKey::CoinsuranceBps)
        .unwrap_or(2000u32) as i128;
    let patient_share = payout_amount
        .checked_mul(bps)
        .unwrap_or_else(|| panic!("overflow"))
        / COINSURANCE_BPS_DENOM;
    payout_amount
        .checked_sub(patient_share)
        .unwrap_or_else(|| panic!("underflow"))
}

pub fn transfer_usdc(
    env: &Env,
    token: &Address,
    from: &Address,
    to: &Address,
    amount: i128,
) {
    let client = soroban_sdk::token::Client::new(env, token);
    client.transfer(from, to, &amount);
}

pub fn get_instance_address(env: &Env, key: InstanceKey) -> Address {
    env.storage()
        .instance()
        .get(&key)
        .unwrap_or_else(|| panic!("missing config"))
}

pub fn pack_inputs(env: &Env, fields: &soroban_sdk::Vec<BytesN<32>>) -> Bytes {
    zklaim_common::pack_fields(env, fields)
}

pub fn field_is_true(field: &BytesN<32>) -> bool {
    field.to_array()[31] == 1
}
