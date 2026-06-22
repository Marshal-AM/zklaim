fn main(
    prev_accumulator_secret: Field,
    new_amount: u64,
    new_amount_blinding: Field,
    deductible_limit: u64,
    prev_accumulator_commit: pub Field,
    new_accumulator_commit: pub Field,
    new_amount_commit: pub Field,
    deductible_met: pub bool,
    claim_hash: pub Field,
) {
    let _ = claim_hash;

    let expected_new_commit = std::hash::poseidon2::Poseidon2::hash(
        [prev_accumulator_secret, new_amount as Field, new_amount_blinding],
        3,
    );
    assert(
        expected_new_commit == new_accumulator_commit,
        "New accumulator commitment incorrect",
    );

    let expected_prev =
        std::hash::poseidon2::Poseidon2::hash([prev_accumulator_secret], 1);
    assert(
        expected_prev == prev_accumulator_commit,
        "Previous accumulator commitment mismatch",
    );

    let recomputed_amount_commit =
        zklaim_common::pedersen_commit(new_amount as Field, new_amount_blinding);
    assert(
        recomputed_amount_commit == new_amount_commit,
        "Amount commitment chain broken",
    );

    let running_total = prev_accumulator_secret + new_amount as Field;
    let expected_met: bool = running_total as u64 >= deductible_limit;
    assert(
        expected_met == deductible_met,
        "Deductible threshold flag incorrect",
    );
}

#[test]
fn test_demo_b_crossing() {
    main(
        test_fixtures::PREV_ACCUM_SECRET_B,
        test_fixtures::NEW_AMOUNT_B,
        test_fixtures::NEW_AMOUNT_BLINDING_B,
        test_fixtures::DEDUCTIBLE_LIMIT,
        test_fixtures::PREV_ACCUM_COMMIT_B,
        test_fixtures::NEW_ACCUM_COMMIT_B,
        test_fixtures::NEW_AMOUNT_COMMIT_B,
        test_fixtures::DEDUCTIBLE_MET_B,
        test_fixtures::CLAIM_HASH,
    );
}

#[test]
fn test_below_threshold() {
    main(
        test_fixtures::PREV_ACCUM_SECRET_BELOW,
        test_fixtures::NEW_AMOUNT_BELOW,
        test_fixtures::NEW_AMOUNT_BLINDING_BELOW,
        test_fixtures::DEDUCTIBLE_LIMIT,
        test_fixtures::PREV_ACCUM_COMMIT_BELOW,
        test_fixtures::NEW_ACCUM_COMMIT_BELOW,
        test_fixtures::NEW_AMOUNT_COMMIT_BELOW,
        test_fixtures::DEDUCTIBLE_MET_BELOW,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Amount commitment chain broken")]
fn test_broken_amount_chain_fails() {
    main(
        test_fixtures::PREV_ACCUM_SECRET_B,
        test_fixtures::NEW_AMOUNT_B,
        test_fixtures::NEW_AMOUNT_BLINDING_B,
        test_fixtures::DEDUCTIBLE_LIMIT,
        test_fixtures::PREV_ACCUM_COMMIT_B,
        test_fixtures::NEW_ACCUM_COMMIT_B,
        0xdead,
        test_fixtures::DEDUCTIBLE_MET_B,
        test_fixtures::CLAIM_HASH,
    );
}

#[test(should_fail_with = "Deductible threshold flag incorrect")]
fn test_wrong_deductible_flag_fails() {
    main(
        test_fixtures::PREV_ACCUM_SECRET_B,
        test_fixtures::NEW_AMOUNT_B,
        test_fixtures::NEW_AMOUNT_BLINDING_B,
        test_fixtures::DEDUCTIBLE_LIMIT,
        test_fixtures::PREV_ACCUM_COMMIT_B,
        test_fixtures::NEW_ACCUM_COMMIT_B,
        test_fixtures::NEW_AMOUNT_COMMIT_B,
        false,
        test_fixtures::CLAIM_HASH,
    );
}
