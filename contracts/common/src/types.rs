use soroban_sdk::{contracttype, Address, Bytes, BytesN, Vec};

/// Claim submission payload — orchestrator entry point.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimPackage {
    pub policy_proof: Bytes,
    pub policy_inputs: Vec<BytesN<32>>,
    pub amount_proof: Bytes,
    pub amount_inputs: Vec<BytesN<32>>,
    pub doctor_proof: Bytes,
    pub doctor_inputs: Vec<BytesN<32>>,
    pub accum_proof: Bytes,
    pub accum_inputs: Vec<BytesN<32>>,
    pub fraud_non_membership_proof: Vec<BytesN<32>>,
    pub fraud_path_indices: Vec<u32>,
    pub nullifier: BytesN<32>,
    pub billing_pattern_hash: BytesN<32>,
    pub insurer: Address,
    pub payout_amount: i128,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Nullifier(BytesN<32>),
}

#[contracttype]
#[derive(Clone)]
pub enum InstanceKey {
    Admin,
    Verifier,
    AspMember,
    AspFraud,
    Policy,
    Tracker,
    UsdcToken,
    InsurerEscrow,
    CoinsuranceBps,
}

pub const COINSURANCE_BPS_DENOM: i128 = 10_000;
