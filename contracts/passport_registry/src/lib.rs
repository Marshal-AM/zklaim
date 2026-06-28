#![no_std]

mod test;
mod tree;

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, Symbol, Vec,
};
use zklaim_common::{pack_fields, CIRCUIT_COUNT};

#[contract]
pub struct PassportRegistry;

#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    ClaimEscrow,
    Verifier,
    NextCredentialId,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    VerifierPermitted(Address),
    Credential(u64),
}

#[contracttype]
#[derive(Clone)]
pub struct CredentialRecord {
    pub patient: Address,
    pub verifier: Address,
    pub circuit_id: u32,
    pub expires_ledger: u32,
    pub valid: bool,
}

#[contractimpl]
impl PassportRegistry {
    pub fn init(env: Env, admin: Address, claim_escrow: Address, verifier: Address) {
        admin.require_auth();
        env.storage().instance().set(&InstanceKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&InstanceKey::ClaimEscrow, &claim_escrow);
        env.storage()
            .instance()
            .set(&InstanceKey::Verifier, &verifier);
        env.storage()
            .instance()
            .set(&InstanceKey::NextCredentialId, &1u64);
    }

    pub fn register_verifier(env: Env, admin: Address, verifier: Address, permitted: bool) {
        Self::require_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::VerifierPermitted(verifier.clone()), &permitted);
        env.storage().persistent().extend_ttl(
            &DataKey::VerifierPermitted(verifier),
            100,
            100_000,
        );
    }

    pub fn is_verifier_registered(env: Env, verifier: Address) -> bool {
        env.storage()
            .persistent()
            .get(&DataKey::VerifierPermitted(verifier))
            .unwrap_or(false)
    }

    pub fn append_leaf(
        env: Env,
        patient: Address,
        settled_nullifier: BytesN<32>,
        leaf_commitment: BytesN<32>,
    ) -> BytesN<32> {
        patient.require_auth();

        let escrow: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::ClaimEscrow)
            .unwrap_or_else(|| panic!("claim escrow not set"));

        let spent: bool = env.invoke_contract(
            &escrow,
            &Symbol::new(&env, "nullifier_spent"),
            (settled_nullifier.clone(),).into_val(&env),
        );
        if !spent {
            panic!("nullifier not spent");
        }

        let (new_root, leaf_count) = tree::insert_leaf(&env, &patient, &leaf_commitment);

        env.events().publish(
            (symbol_short!("leaf"), symbol_short!("append")),
            (patient.clone(), new_root.clone(), leaf_count),
        );

        new_root
    }

    pub fn get_root(env: Env, patient: Address) -> BytesN<32> {
        tree::get_root(&env, &patient)
    }

    pub fn get_leaf_count(env: Env, patient: Address) -> u32 {
        tree::leaf_count(&env, &patient)
    }

    pub fn get_merkle_path(env: Env, patient: Address, index: u32) -> Vec<BytesN<32>> {
        tree::get_merkle_path(&env, &patient, index)
    }

    pub fn verify_credential(
        env: Env,
        patient: Address,
        verifier: Address,
        circuit_id: u32,
        public_inputs: Vec<BytesN<32>>,
        proof: Bytes,
        ttl_ledgers: u32,
    ) -> u64 {
        patient.require_auth();

        if circuit_id >= CIRCUIT_COUNT {
            panic!("invalid circuit id");
        }

        let registered: bool = env
            .storage()
            .persistent()
            .get(&DataKey::VerifierPermitted(verifier.clone()))
            .unwrap_or(false);
        if !registered {
            panic!("verifier not registered");
        }

        let ultrahonk: Address = env
            .storage()
            .instance()
            .get(&InstanceKey::Verifier)
            .unwrap_or_else(|| panic!("verifier contract not set"));

        let packed = pack_fields(&env, &public_inputs);
        let ok: bool = env.invoke_contract(
            &ultrahonk,
            &Symbol::new(&env, "verify"),
            (circuit_id, packed, proof).into_val(&env),
        );
        if !ok {
            panic!("credential proof invalid");
        }

        let mut id: u64 = env
            .storage()
            .instance()
            .get(&InstanceKey::NextCredentialId)
            .unwrap_or(1);
        let expires = env.ledger().sequence() + ttl_ledgers;
        let record = CredentialRecord {
            patient: patient.clone(),
            verifier: verifier.clone(),
            circuit_id,
            expires_ledger: expires,
            valid: true,
        };
        env.storage().persistent().set(&DataKey::Credential(id), &record);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Credential(id), 100, 100_000);

        id += 1;
        env.storage()
            .instance()
            .set(&InstanceKey::NextCredentialId, &id);

        env.events().publish(
            (symbol_short!("cred"), symbol_short!("issued")),
            (id - 1, verifier, circuit_id, expires),
        );

        id - 1
    }

    pub fn is_credential_valid(env: Env, credential_id: u64) -> bool {
        let record: CredentialRecord = env
            .storage()
            .persistent()
            .get(&DataKey::Credential(credential_id))
            .unwrap_or_else(|| panic!("credential not found"));
        if !record.valid {
            return false;
        }
        env.ledger().sequence() <= record.expires_ledger
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

use soroban_sdk::IntoVal;
