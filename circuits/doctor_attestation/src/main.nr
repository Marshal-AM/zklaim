fn main(
    doctor_secret: Field,
    doctor_leaf_index: u64,
    asp_merkle_path: [Field; 10],
    claim_data_secret: Field,
    asp_merkle_root: pub Field,
    doctor_commitment: pub Field,
    claim_hash: pub Field,
    attestation_hash: pub Field,
) {
    let _ = claim_data_secret;

    let leaf = std::hash::poseidon2::Poseidon2::hash([doctor_secret], 1);
    let computed_root =
        zklaim_common::compute_merkle_root(leaf, doctor_leaf_index, asp_merkle_path);
    assert(
        computed_root == asp_merkle_root,
        "Doctor not in ASP membership tree",
    );

    let computed_commit = std::hash::poseidon2::Poseidon2::hash([doctor_secret], 1);
    assert(computed_commit == doctor_commitment, "Doctor commitment mismatch");

    let computed_attestation = std::hash::poseidon2::Poseidon2::hash(
        [doctor_secret, claim_hash],
        2,
    );
    assert(
        computed_attestation == attestation_hash,
        "Attestation does not match this claim",
    );
}

#[test]
fn test_enrolled_doctor_valid_attestation() {
    main(
        test_fixtures::DOCTOR_SECRET,
        test_fixtures::DOCTOR_LEAF_INDEX,
        test_fixtures::ASP_MERKLE_PATH,
        test_fixtures::CLAIM_DATA_SECRET,
        test_fixtures::ASP_MERKLE_ROOT,
        test_fixtures::DOCTOR_COMMITMENT,
        test_fixtures::CLAIM_HASH,
        test_fixtures::ATTESTATION_HASH,
    );
}

#[test(should_fail_with = "Doctor not in ASP membership tree")]
fn test_wrong_asp_root_fails() {
    main(
        test_fixtures::DOCTOR_SECRET,
        test_fixtures::DOCTOR_LEAF_INDEX,
        test_fixtures::ASP_MERKLE_PATH,
        test_fixtures::CLAIM_DATA_SECRET,
        0xdead,
        test_fixtures::DOCTOR_COMMITMENT,
        test_fixtures::CLAIM_HASH,
        test_fixtures::ATTESTATION_HASH,
    );
}

#[test(should_fail_with = "Attestation does not match this claim")]
fn test_wrong_attestation_hash_fails() {
    main(
        test_fixtures::DOCTOR_SECRET,
        test_fixtures::DOCTOR_LEAF_INDEX,
        test_fixtures::ASP_MERKLE_PATH,
        test_fixtures::CLAIM_DATA_SECRET,
        test_fixtures::ASP_MERKLE_ROOT,
        test_fixtures::DOCTOR_COMMITMENT,
        test_fixtures::CLAIM_HASH,
        0xdead,
    );
}
