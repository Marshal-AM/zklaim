pub const CIRCUIT_POLICY_VALIDITY: u32 = 0;
pub const CIRCUIT_AMOUNT_RANGE: u32 = 1;
pub const CIRCUIT_DOCTOR_ATTESTATION: u32 = 2;
pub const CIRCUIT_DEDUCTIBLE_ACCUMULATOR: u32 = 3;
pub const CIRCUIT_CATEGORY_NONMEMBERSHIP: u32 = 4;

pub const CIRCUIT_COUNT: u32 = 5;

pub fn is_valid_circuit_id(circuit_id: u32) -> bool {
    circuit_id < CIRCUIT_COUNT
}
