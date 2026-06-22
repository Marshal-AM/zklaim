// Alignment gate: JS tree builders must match these test vectors.
// Regenerate expected values: npm run build -w scripts -- generate_poseidon_vectors.ts

#[test]
fn test_poseidon2_hash_three() {
    let h = std::hash::poseidon2::Poseidon2::hash([1, 2, 3], 3);
    assert(
        h
            == 0x23864adb160dddf590f1d3303683ebcb914f828e2635f6e85a32f0a1aecd3dd8,
        "hash([1,2,3], 3) mismatch",
    );
}

#[test]
fn test_poseidon2_hash_one() {
    let h = std::hash::poseidon2::Poseidon2::hash([1], 1);
    assert(
        h
            == 0x168758332d5b3e2d13be8048c8011b454590e06c44bce7f702f09103eef5a373,
        "hash([1], 1) mismatch",
    );
}

#[test]
fn test_poseidon2_hash_pair() {
    let h = std::hash::poseidon2::Poseidon2::hash([1, 2], 2);
    assert(
        h
            == 0x038682aa1cb5ae4e0a3f13da432a95c77c5c111f6f030faf9cad641ce1ed7383,
        "hash([1,2], 2) mismatch",
    );
}

fn main() {}
