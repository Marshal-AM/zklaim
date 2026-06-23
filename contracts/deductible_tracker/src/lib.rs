#![no_std]

mod test;

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec};
use zklaim_common::{pack_fields, zero_field, CIRCUIT_DEDUCTIBLE_ACCUMULATOR};

#[contract]
pub struct DeductibleTracker;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Accumulator(Address),
}

#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Verifier,
    Admin,
    ClaimEscrow,
}

#[contractimpl]
impl DeductibleTracker {
    pub fn init(env: Env, verifier: Address, admin: Address) {
        env.storage().instance().set(&InstanceKey::Verifier, &verifier);
        env.storage().instance().set(&InstanceKey::Admin, &admin);
    }

    /// Called once after claim_escrow is deployed to register it as the sole
    /// authorised caller of update_accumulator. Requires admin signature.
    pub fn set_escrow(env: Env, escrow: Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::Admin)
            .unwrap_or_else(|| panic!("not initialised"));
        admin.require_auth();
        env.storage().instance().set(&InstanceKey::ClaimEscrow, &escrow);
    }

    pub fn get_accumulator(env: Env, patient: Address) -> BytesN<32> {
        let key = DataKey::Accumulator(patient);
        if env.storage().persistent().has(&key) {
            env.storage().persistent().get(&key).unwrap()
        } else {
            zero_field(&env)
        }
    }

    pub fn update_accumulator(
        env: Env,
        patient: Address,
        new_commitment: BytesN<32>,
        proof: Bytes,
        public_inputs: Vec<BytesN<32>>,
    ) -> bool {
        // Only claim_escrow may call this; when invoked cross-contract the
        // Soroban host satisfies escrow.require_auth() automatically without
        // adding a patient sub-invocation to the auth tree. This keeps the
        // transaction envelope under the 132 KB per-tx size limit.
        let escrow: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::ClaimEscrow)
            .unwrap_or_else(|| panic!("escrow not set"));
        escrow.require_auth();

        if public_inputs.len() != 5 {
            panic!("invalid accumulator public inputs");
        }

        let stored_prev = Self::get_accumulator(env.clone(), patient.clone());
        let prev_commit = public_inputs.get(0).unwrap();
        let new_commit = public_inputs.get(1).unwrap();
        let _amount_commit = public_inputs.get(2).unwrap();
        let deductible_met = public_inputs.get(3).unwrap();
        let _claim_hash = public_inputs.get(4).unwrap();

        let genesis = stored_prev == zero_field(&env);
        if !genesis && prev_commit != stored_prev {
            panic!("previous accumulator mismatch");
        }
        if new_commit != new_commitment {
            panic!("new commitment mismatch");
        }

        let verifier: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::Verifier)
            .unwrap_or_else(|| panic!("verifier not set"));
        let packed = pack_fields(&env, &public_inputs);
        let ok: bool = env.invoke_contract(
            &verifier,
            &Symbol::new(&env, "verify"),
            (CIRCUIT_DEDUCTIBLE_ACCUMULATOR, packed, proof).into_val(&env),
        );
        if !ok {
            panic!("accumulator proof invalid");
        }

        env.storage()
            .persistent()
            .set(&DataKey::Accumulator(patient.clone()), &new_commitment);
        env.storage().persistent().extend_ttl(
            &DataKey::Accumulator(patient.clone()),
            100,
            100_000,
        );

        env.events().publish(
            (symbol_short!("accum"),),
            (patient, new_commitment, deductible_met),
        );
        true
    }
}

use soroban_sdk::IntoVal;
