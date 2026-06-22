use soroban_poseidon::poseidon2_hash as sp_poseidon2_hash;
use soroban_sdk::{crypto::bn254::Bn254Fr, vec, Bytes, BytesN, Env, U256, Vec};

fn bytes_to_u256(env: &Env, b: &BytesN<32>) -> U256 {
    U256::from_be_bytes(env, &Bytes::from_array(env, &b.to_array()))
}

fn u256_to_bytes(env: &Env, value: U256) -> BytesN<32> {
    let bytes = value.to_be_bytes();
    let mut arr = [0u8; 32];
    bytes.copy_into_slice(&mut arr);
    BytesN::from_array(env, &arr)
}

/// Poseidon2 hash with explicit message length (matches Noir hash_internal).
pub fn poseidon2_hash(env: &Env, inputs: &Vec<BytesN<32>>, message_size: u32) -> BytesN<32> {
    let mut absorb = Vec::new(env);
    for i in 0..message_size {
        absorb.push_back(bytes_to_u256(env, &inputs.get(i).unwrap()));
    }
    let hash = sp_poseidon2_hash::<4, Bn254Fr>(env, &absorb);
    u256_to_bytes(env, hash)
}

pub fn poseidon2_hash_1(env: &Env, a: &BytesN<32>) -> BytesN<32> {
    let inputs = vec![env, a.clone()];
    poseidon2_hash(env, &inputs, 1)
}

pub fn poseidon2_hash_2(env: &Env, a: &BytesN<32>, b: &BytesN<32>) -> BytesN<32> {
    let inputs = vec![env, a.clone(), b.clone()];
    poseidon2_hash(env, &inputs, 2)
}

pub fn poseidon2_hash_3(
    env: &Env,
    a: &BytesN<32>,
    b: &BytesN<32>,
    c: &BytesN<32>,
) -> BytesN<32> {
    let inputs = vec![env, a.clone(), b.clone(), c.clone()];
    poseidon2_hash(env, &inputs, 3)
}

pub fn doctor_leaf(env: &Env, doctor_secret: &BytesN<32>) -> BytesN<32> {
    poseidon2_hash_1(env, doctor_secret)
}

pub fn doctor_secret(
    env: &Env,
    license_hash: &BytesN<32>,
    specialty_code: &BytesN<32>,
    jurisdiction_hash: &BytesN<32>,
) -> BytesN<32> {
    poseidon2_hash_3(env, license_hash, specialty_code, jurisdiction_hash)
}

pub fn enroll_doctor_leaf(
    env: &Env,
    license_hash: &BytesN<32>,
    specialty_code: &BytesN<32>,
    jurisdiction_hash: &BytesN<32>,
) -> BytesN<32> {
    let secret = doctor_secret(env, license_hash, specialty_code, jurisdiction_hash);
    doctor_leaf(env, &secret)
}

pub fn billing_pattern_hash(
    env: &Env,
    icd_category: &BytesN<32>,
    amount_bucket: &BytesN<32>,
    provider_type: &BytesN<32>,
) -> BytesN<32> {
    poseidon2_hash_3(env, icd_category, amount_bucket, provider_type)
}
