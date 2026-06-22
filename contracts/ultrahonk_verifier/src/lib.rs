#![no_std]

mod test;

use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Bytes, Env};
use ultrahonk_soroban_verifier::{UltraHonkVerifier, VkLoadError, PROOF_BYTES};
use zklaim_common::{is_valid_circuit_id, pack_fields, CIRCUIT_COUNT};

#[contract]
pub struct UltraHonkVerifierContract;

#[contracttype]
#[derive(Clone)]
pub enum StorageKey {
    Vk(u32),
    Admin,
}

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    InvalidCircuitId = 1,
    Unauthorized = 2,
    VkInvalidLength = 3,
    VkInvalidParameters = 4,
    ProofParseError = 5,
    VerificationFailed = 6,
    VkNotSet = 7,
}

#[contractimpl]
impl UltraHonkVerifierContract {
    pub fn init_admin(env: Env, admin: Address) {
        if env.storage().instance().has(&StorageKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&StorageKey::Admin, &admin);
    }

    pub fn init(env: Env, admin: Address, circuit_id: u32, vk_bytes: Bytes) -> Result<(), Error> {
        Self::require_admin(&env, &admin);
        if !is_valid_circuit_id(circuit_id) {
            return Err(Error::InvalidCircuitId);
        }
        let _ = UltraHonkVerifier::new(&env, &vk_bytes).map_err(|e| match e {
            VkLoadError::WrongLength => Error::VkInvalidLength,
            VkLoadError::InvalidParameters => Error::VkInvalidParameters,
        })?;
        env.storage()
            .instance()
            .set(&StorageKey::Vk(circuit_id), &vk_bytes);
        Ok(())
    }

    /// Verify proof against concatenated 32-byte public input field elements.
    pub fn verify(
        env: Env,
        circuit_id: u32,
        public_inputs: Bytes,
        proof: Bytes,
    ) -> Result<bool, Error> {
        if !is_valid_circuit_id(circuit_id) {
            return Err(Error::InvalidCircuitId);
        }
        if proof.len() as usize != PROOF_BYTES {
            return Err(Error::ProofParseError);
        }
        if !public_inputs.len().is_multiple_of(32) {
            return Err(Error::VerificationFailed);
        }

        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&StorageKey::Vk(circuit_id))
            .ok_or(Error::VkNotSet)?;

        let verifier = UltraHonkVerifier::new(&env, &vk_bytes).map_err(|e| match e {
            VkLoadError::WrongLength => Error::VkInvalidLength,
            VkLoadError::InvalidParameters => Error::VkInvalidParameters,
        })?;

        verifier
            .verify(&env, &proof, &public_inputs)
            .map_err(|_| Error::VerificationFailed)?;
        Ok(true)
    }

    pub fn verify_fields(
        env: Env,
        circuit_id: u32,
        public_inputs: soroban_sdk::Vec<soroban_sdk::BytesN<32>>,
        proof: Bytes,
    ) -> Result<bool, Error> {
        let packed = pack_fields(&env, &public_inputs);
        Self::verify(env, circuit_id, packed, proof)
    }

    pub fn vk_initialized(env: Env, circuit_id: u32) -> bool {
        if circuit_id >= CIRCUIT_COUNT {
            return false;
        }
        env.storage().instance().has(&StorageKey::Vk(circuit_id))
    }

    fn require_admin(env: &Env, admin: &Address) {
        let stored: Address = env
            .storage()
            .instance()
            .get(&StorageKey::Admin)
            .unwrap_or_else(|| panic!("admin not set"));
        if stored != *admin {
            panic!("unauthorized");
        }
        admin.require_auth();
    }
}
