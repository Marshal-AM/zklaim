fn main(
    raw_amount: u64,
    blinding_factor: Field,
    policy_floor_cents: u64,
    policy_ceiling_cents: u64,
    amount_commitment: pub Field,
    policy_bounds_hash: pub Field,
    claim_hash: pub Field,
) {
    let _ = claim_hash;

    assert(raw_amount >= policy_floor_cents, "Amount below policy floor");
    assert(raw_amount <= policy_ceiling_cents, "Amount exceeds policy ceiling");

    let computed_commit = zklaim_common::pedersen_commit(raw_amount as Field, blinding_factor);
    assert(computed_commit == amount_commitment, "Amount commitment mismatch");

    let bounds_check = std::hash::poseidon2::Poseidon2::hash(
        [policy_floor_cents as Field, policy_ceiling_cents as Field],
        2,
    );
    assert(bounds_check == policy_bounds_hash, "Policy bounds commitment mismatch");
}

#[test]
fn test_valid_demo_a_amount() {
    main(
        test_fixtures::RAW_AMOUNT_A,
        test_fixtures::BLINDING_A,
        test_fixtures::POLICY_FLOOR,
        test_fixtures::POLICY_CEILING,
        test_fixtures::AMOUNT_COMMITMENT_A,
        test_fixtures::POLICY_BOUNDS_HASH,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Amount below policy floor")]
fn test_below_floor_fails() {
    main(
        test_fixtures::POLICY_FLOOR - 1,
        test_fixtures::BLINDING_A,
        test_fixtures::POLICY_FLOOR,
        test_fixtures::POLICY_CEILING,
        test_fixtures::AMOUNT_COMMITMENT_A,
        test_fixtures::POLICY_BOUNDS_HASH,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Amount exceeds policy ceiling")]
fn test_above_ceiling_fails() {
    main(
        test_fixtures::POLICY_CEILING + 1,
        test_fixtures::BLINDING_A,
        test_fixtures::POLICY_FLOOR,
        test_fixtures::POLICY_CEILING,
        test_fixtures::AMOUNT_COMMITMENT_A,
        test_fixtures::POLICY_BOUNDS_HASH,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Amount commitment mismatch")]
fn test_wrong_commitment_fails() {
    main(
        test_fixtures::RAW_AMOUNT_A,
        test_fixtures::BLINDING_A,
        test_fixtures::POLICY_FLOOR,
        test_fixtures::POLICY_CEILING,
        0xdead,
        test_fixtures::POLICY_BOUNDS_HASH,
        test_fixtures::CLAIM_HASH,
    );
}
