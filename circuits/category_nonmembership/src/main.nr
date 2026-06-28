use dep::std::hash::poseidon2::Poseidon2;

global MAX_LEAVES: u32 = 32;
global TREE_DEPTH: u32 = 8;

fn main(
    passport_root: pub Field,
    excluded_category: pub Field,
    claim_count: pub u32,
    leaf_nullifiers: [Field; 32],
    leaf_secrets: [Field; 32],
    leaf_categories: [Field; 32],
    leaf_amount_bkts: [Field; 32],
    leaf_months: [Field; 32],
    merkle_paths: [[Field; 8]; 32],
    leaf_active: [bool; 32],
) {
    let mut active_count: u32 = 0;
    for i in 0..MAX_LEAVES {
        if leaf_active[i] {
            active_count += 1;
            let leaf = Poseidon2::hash(
                [
                    leaf_nullifiers[i],
                    leaf_secrets[i],
                    leaf_categories[i],
                    leaf_amount_bkts[i],
                    leaf_months[i],
                ],
                5,
            );
            let computed_root =
                zklaim_common::compute_merkle_root_depth8(leaf, i as u64, merkle_paths[i]);
            assert(computed_root == passport_root, "Leaf not in passport tree");
            assert(
                leaf_categories[i] != excluded_category,
                "Excluded category found in claim history",
            );
        }
    }
    assert(active_count == claim_count, "Leaf count mismatch with on-chain record");
}
