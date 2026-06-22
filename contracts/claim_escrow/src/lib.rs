#![no_std]

mod escrow;
mod nullifier;
mod test;
mod types;

use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env, Symbol};
use types::{ClaimPackage, InstanceKey};
use zklaim_common::{
    CIRCUIT_AMOUNT_RANGE, CIRCUIT_DOCTOR_ATTESTATION, CIRCUIT_POLICY_VALIDITY,
};

#[contract]
pub struct ClaimEscrow;

#[contractimpl]
impl ClaimEscrow {
    #[allow(clippy::too_many_arguments)]
    pub fn init(
        env: Env,
        admin: Address,
        verifier: Address,
        asp_member: Address,
        asp_fraud: Address,
        policy: Address,
        tracker: Address,
        usdc_token: Address,
        insurer_escrow: Address,
        coinsurance_bps: u32,
    ) {
        admin.require_auth();
        env.storage().instance().set(&InstanceKey::Admin, &admin);
        env.storage().instance().set(&InstanceKey::Verifier, &verifier);
        env.storage().instance().set(&InstanceKey::AspMember, &asp_member);
        env.storage().instance().set(&InstanceKey::AspFraud, &asp_fraud);
        env.storage().instance().set(&InstanceKey::Policy, &policy);
        env.storage().instance().set(&InstanceKey::Tracker, &tracker);
        env.storage()
            .instance()
            .set(&InstanceKey::UsdcToken, &usdc_token);
        env.storage()
            .instance()
            .set(&InstanceKey::InsurerEscrow, &insurer_escrow);
        env.storage()
            .instance()
            .set(&InstanceKey::CoinsuranceBps, &coinsurance_bps);
    }

    pub fn submit_claim(env: Env, patient: Address, pkg: ClaimPackage) {
        patient.require_auth();

        if nullifier::is_spent(&env, &pkg.nullifier) {
            panic!("nullifier already spent");
        }

        let verifier = escrow::get_instance_address(&env, InstanceKey::Verifier);
        let asp_member = escrow::get_instance_address(&env, InstanceKey::AspMember);
        let asp_fraud = escrow::get_instance_address(&env, InstanceKey::AspFraud);
        let policy = escrow::get_instance_address(&env, InstanceKey::Policy);
        let tracker = escrow::get_instance_address(&env, InstanceKey::Tracker);
        let usdc = escrow::get_instance_address(&env, InstanceKey::UsdcToken);
        let insurer = escrow::get_instance_address(&env, InstanceKey::InsurerEscrow);

        Self::verify_circuit(
            &env,
            &verifier,
            CIRCUIT_POLICY_VALIDITY,
            &pkg.policy_inputs,
            &pkg.policy_proof,
        );
        Self::verify_circuit(
            &env,
            &verifier,
            CIRCUIT_AMOUNT_RANGE,
            &pkg.amount_inputs,
            &pkg.amount_proof,
        );
        Self::verify_circuit(
            &env,
            &verifier,
            CIRCUIT_DOCTOR_ATTESTATION,
            &pkg.doctor_inputs,
            &pkg.doctor_proof,
        );

        let coverage_root: BytesN<32> = env.invoke_contract(
            &policy,
            &Symbol::new(&env, "get_coverage_root"),
            (pkg.insurer.clone(),).into_val(&env),
        );
        let bounds_hash: BytesN<32> = env.invoke_contract(
            &policy,
            &Symbol::new(&env, "get_bounds_hash"),
            (pkg.insurer.clone(),).into_val(&env),
        );
        let active: bool = env.invoke_contract(
            &policy,
            &Symbol::new(&env, "is_active"),
            (pkg.insurer.clone(),).into_val(&env),
        );
        if !active {
            panic!("policy expired");
        }

        if pkg.policy_inputs.get(0).unwrap() != coverage_root {
            panic!("coverage root mismatch");
        }
        if pkg.amount_inputs.get(1).unwrap() != bounds_hash {
            panic!("bounds hash mismatch");
        }

        let asp_root: BytesN<32> = env.invoke_contract(
            &asp_member,
            &Symbol::new(&env, "get_root"),
            ().into_val(&env),
        );
        if pkg.doctor_inputs.get(0).unwrap() != asp_root {
            panic!("asp root mismatch");
        }

        let flagged: bool = env.invoke_contract(
            &asp_fraud,
            &Symbol::new(&env, "contains"),
            (pkg.billing_pattern_hash.clone(),).into_val(&env),
        );
        if flagged {
            panic!("billing pattern flagged as fraud");
        }
        let nm_ok: bool = env.invoke_contract(
            &asp_fraud,
            &Symbol::new(&env, "verify_non_membership"),
            (
                pkg.billing_pattern_hash.clone(),
                pkg.fraud_non_membership_proof.clone(),
                pkg.fraud_path_indices.clone(),
            )
                .into_val(&env),
        );
        if !nm_ok {
            panic!("fraud non-membership proof invalid");
        }

        let accum_inputs = pkg.accum_inputs.clone();
        let new_commit = accum_inputs.get(1).unwrap();
        env.invoke_contract::<bool>(
            &tracker,
            &Symbol::new(&env, "update_accumulator"),
            (
                patient.clone(),
                new_commit,
                pkg.accum_proof.clone(),
                accum_inputs,
            )
                .into_val(&env),
        );

        let deductible_met = escrow::field_is_true(&pkg.accum_inputs.get(3).unwrap());
        let payout = escrow::compute_payout(&env, pkg.payout_amount, deductible_met);

        nullifier::mark_spent(&env, &pkg.nullifier);
        escrow::transfer_usdc(&env, &usdc, &insurer, &patient, payout);

        env.events().publish(
            (symbol_short!("claim"),),
            (pkg.nullifier, patient, payout),
        );
    }

    pub fn preview_payout(env: Env, payout_amount: i128, deductible_met: bool) -> i128 {
        escrow::compute_payout(&env, payout_amount, deductible_met)
    }

    pub fn nullifier_spent(env: Env, nullifier: BytesN<32>) -> bool {
        nullifier::is_spent(&env, &nullifier)
    }

    fn verify_circuit(
        env: &Env,
        verifier: &Address,
        circuit_id: u32,
        inputs: &soroban_sdk::Vec<BytesN<32>>,
        proof: &soroban_sdk::Bytes,
    ) {
        let packed = escrow::pack_inputs(env, inputs);
        let ok: bool = env.invoke_contract(
            verifier,
            &Symbol::new(env, "verify"),
            (circuit_id, packed, proof.clone()).into_val(env),
        );
        if !ok {
            panic!("proof verification failed");
        }
    }
}

use soroban_sdk::IntoVal;
