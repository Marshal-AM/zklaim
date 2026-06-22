fn main(
    icd_code: Field,
    icd_leaf_index: u64,
    icd_merkle_path: [Field; 10],
    policy_secret: Field,
    coverage_merkle_root: pub Field,
    policy_commitment: pub Field,
    claim_hash: pub Field,
) {
    let _ = claim_hash;
    let leaf = std::hash::poseidon2::Poseidon2::hash([icd_code], 1);
    let computed_root = zklaim_common::compute_merkle_root(leaf, icd_leaf_index, icd_merkle_path);
    assert(
        computed_root == coverage_merkle_root,
        "ICD code not covered under this policy",
    );

    let expected_commitment =
        std::hash::poseidon2::Poseidon2::hash([icd_code, policy_secret], 2);
    assert(
        expected_commitment == policy_commitment,
        "Invalid policy commitment",
    );
}

#[test]
fn test_valid_j189_membership() {
    main(
        test_fixtures::ICD_CODE,
        test_fixtures::ICD_LEAF_INDEX,
        test_fixtures::ICD_MERKLE_PATH,
        test_fixtures::POLICY_SECRET,
        test_fixtures::COVERAGE_MERKLE_ROOT,
        test_fixtures::POLICY_COMMITMENT,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "ICD code not covered under this policy")]
fn test_invalid_root_fails() {
    main(
        test_fixtures::ICD_CODE,
        test_fixtures::ICD_LEAF_INDEX,
        test_fixtures::ICD_MERKLE_PATH,
        test_fixtures::POLICY_SECRET,
        0xdead,
        test_fixtures::POLICY_COMMITMENT,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Invalid policy commitment")]
fn test_invalid_policy_commitment_fails() {
    main(
        test_fixtures::ICD_CODE,
        test_fixtures::ICD_LEAF_INDEX,
        test_fixtures::ICD_MERKLE_PATH,
        test_fixtures::POLICY_SECRET,
        test_fixtures::COVERAGE_MERKLE_ROOT,
        0xdead,
        test_fixtures::CLAIM_HASH,
    );
}
