#![cfg(test)]
extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Bytes, Env};
use ultrahonk_soroban_verifier::PROOF_BYTES;

use crate::{UltraHonkVerifierContract, UltraHonkVerifierContractClient};

const VK_BYTES: usize = 1760;

fn fixture_path(name: &str) -> std::path::PathBuf {
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("circuits")
        .join("target")
        .join("bb")
        .join(name)
}

fn read_bytes(path: &std::path::Path) -> Option<std::vec::Vec<u8>> {
    std::fs::read(path).ok()
}

fn hex_to_bytes32(hex: &str) -> [u8; 32] {
    let mut out = [0u8; 32];
    let bytes: std::vec::Vec<u8> = (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap())
        .collect();
    out[32 - bytes.len()..].copy_from_slice(&bytes);
    out
}

#[test]
fn test_verify_valid_proof() {
    let vk_path = fixture_path("policy_validity/vk");
    let proof_path = fixture_path("policy_validity/proof");
    let Some(vk) = read_bytes(&vk_path) else {
        std::eprintln!("Skipping test_verify_valid_proof — run bash scripts/test_circuits.sh first");
        return;
    };
    let Some(proof) = read_bytes(&proof_path) else {
        panic!("proof fixture missing");
    };
    assert_eq!(vk.len(), VK_BYTES, "VK must be 1760 bytes (bb 0.87 + --oracle_hash keccak)");
    assert_eq!(proof.len(), PROOF_BYTES, "proof must be 14592 bytes");

    let env = Env::default();
    let admin = Address::generate(&env);
    env.mock_all_auths();

    let contract_id = env.register(UltraHonkVerifierContract, ());
    let client = UltraHonkVerifierContractClient::new(&env, &contract_id);

    client.init_admin(&admin);
    client
        .try_init(&admin, &0u32, &Bytes::from_slice(&env, vk.as_slice()))
        .unwrap()
        .unwrap();

    let coverage = hex_to_bytes32("080072aa0d6d0b1dc8a2b727b484ee6c2b4fd0e6280bbe256f3373fd4120f271");
    let policy_commit = hex_to_bytes32("2e339f42d0af4db9994a4050f0f59977fa4eaeef7912a2c36998d4d3f3005c82");
    let claim_hash = hex_to_bytes32("1acba43989a7d30d5d78ee024d7a85107e175cc18b11a0888d9d6bde7c65cad7");

    let mut packed = Bytes::new(&env);
    for field in [coverage, policy_commit, claim_hash] {
        packed.extend_from_array(&field);
    }

    let ok = client
        .try_verify(
            &0u32,
            &packed,
            &Bytes::from_slice(&env, proof.as_slice()),
        )
        .unwrap()
        .unwrap();
    assert!(ok);
}

#[test]
fn test_reject_invalid_proof() {
    let vk_path = fixture_path("policy_validity/vk");
    let Some(vk) = read_bytes(&vk_path) else {
        std::eprintln!("Skipping test_reject_invalid_proof — missing VK fixture");
        return;
    };

    let env = Env::default();
    let admin = Address::generate(&env);
    env.mock_all_auths();

    let contract_id = env.register(UltraHonkVerifierContract, ());
    let client = UltraHonkVerifierContractClient::new(&env, &contract_id);
    client.init_admin(&admin);
    client
        .try_init(&admin, &0u32, &Bytes::from_slice(&env, vk.as_slice()))
        .unwrap()
        .unwrap();

    let mut bad_proof = std::vec![0u8; PROOF_BYTES];
    bad_proof[0] ^= 0xff;

    let packed = Bytes::from_slice(&env, &[0u8; 96]);
    let err = client.try_verify(
        &0u32,
        &packed,
        &Bytes::from_slice(&env, bad_proof.as_slice()),
    );
    assert!(err.is_err());
}

#[test]
fn test_vk_init_accepts_keccak_vk() {
    let vk_path = fixture_path("policy_validity/vk");
    let Some(vk) = read_bytes(&vk_path) else {
        std::eprintln!("Skipping test_vk_init_accepts_keccak_vk — missing VK fixture");
        return;
    };

    let env = Env::default();
    let admin = Address::generate(&env);
    env.mock_all_auths();

    let contract_id = env.register(UltraHonkVerifierContract, ());
    let client = UltraHonkVerifierContractClient::new(&env, &contract_id);
    client.init_admin(&admin);
    client
        .try_init(&admin, &0u32, &Bytes::from_slice(&env, vk.as_slice()))
        .unwrap()
        .unwrap();
    assert!(client.vk_initialized(&0));
}
