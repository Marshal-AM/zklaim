/// Recompute Merkle root from leaf + sibling path (depth 8, Poseidon2 pairs).
pub fn compute_merkle_root_depth8(leaf: Field, index: u64, path: [Field; 8]) -> Field {
    let mut current = leaf;
    for i in 0..8 {
        let is_right = (index >> i) & 1;
        let (l, r) = if is_right == 1 {
            (path[i], current)
        } else {
            (current, path[i])
        };
        current = std::hash::poseidon2::Poseidon2::hash([l, r], 2);
    }
    current
}

pub fn compute_merkle_root(leaf: Field, index: u64, path: [Field; 10]) -> Field {
    let mut current = leaf;
    for i in 0..10 {
        let is_right = (index >> i) & 1;
        let (l, r) = if is_right == 1 {
            (path[i], current)
        } else {
            (current, path[i])
        };
        current = std::hash::poseidon2::Poseidon2::hash([l, r], 2);
    }
    current
}

/// Pedersen commitment via Noir stdlib (embedded-curve MSM; x-coordinate output).
pub fn pedersen_commit(value: Field, blinding: Field) -> Field {
    std::hash::pedersen_commitment([value, blinding]).x
}
