use soroban_sdk::contracttype;

pub use zklaim_common::ClaimPackage;

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
