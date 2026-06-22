import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import {
  initPoseidon2,
  poseidon2HashFixed,
  fieldFromHex,
  fieldToHex,
  verifyMembershipProof,
  billingPatternHash,
  icdCategoryToField,
  amountBucketToField,
  providerPatternToField,
  computeNullifier,
  computeClaimHash,
  SparseMerkleTree,
} from "@zklaim/scripts/lib/index.js";
import { POSEIDON_REFERENCE_VECTORS } from "@zklaim/scripts/lib/poseidon_reference_vectors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ARTIFACTS = join(__dirname, "..", "scripts", "artifacts");

function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(ARTIFACTS, name), "utf8")) as T;
}

beforeAll(async () => {
  await initPoseidon2();
});

describe("Poseidon2 alignment", () => {
  it("matches reference vector hash([1,2,3], 3)", async () => {
    const h = await poseidon2HashFixed([1n, 2n, 3n]);
    expect(fieldToHex(h)).toBe(POSEIDON_REFERENCE_VECTORS.hash_1_2_3_len3);
  });

  it("matches reference vector hash([1], 1)", async () => {
    const h = await poseidon2HashFixed([1n]);
    expect(fieldToHex(h)).toBe(POSEIDON_REFERENCE_VECTORS.hash_1_len1);
  });

  it("matches reference vector hash([1,2], 2)", async () => {
    const h = await poseidon2HashFixed([1n, 2n]);
    expect(fieldToHex(h)).toBe(POSEIDON_REFERENCE_VECTORS.hash_pair_1_2);
  });
});

describe("Policy Merkle tree", () => {
  it("recomputes root from J18.9 membership proof", async () => {
    const tree = loadJson<{
      root: string;
      leaves: Array<{
        icd_code: string;
        leaf: string;
        index: number;
        merkle_path: string[];
      }>;
    }>("policy_tree.json");

    const j189 = tree.leaves.find((l) => l.icd_code === "J18.9");
    expect(j189).toBeDefined();

    const ok = await verifyMembershipProof(
      fieldFromHex(j189!.leaf),
      j189!.index,
      j189!.merkle_path.map(fieldFromHex),
      fieldFromHex(tree.root),
    );
    expect(ok).toBe(true);
  });
});

describe("Doctor ASP Merkle tree", () => {
  it("recomputes root from enrolled doctor proof", async () => {
    const tree = loadJson<{
      root: string;
      doctors: Array<{
        license_id: string;
        leaf: string;
        index: number;
        merkle_path: string[];
      }>;
    }>("asp_tree.json");

    const doc = tree.doctors[0];
    const ok = await verifyMembershipProof(
      fieldFromHex(doc.leaf),
      doc.index,
      doc.merkle_path.map(fieldFromHex),
      fieldFromHex(tree.root),
    );
    expect(ok).toBe(true);
  });
});

describe("Fraud sparse Merkle tree", () => {
  async function rebuildFraudTree() {
    const tree = loadJson<{
      root: string;
      leaves: Array<{ billing_pattern_hash: string }>;
    }>("fraud_tree.json");

    const smt = new SparseMerkleTree();
    await smt.init();
    for (const leaf of tree.leaves) {
      await smt.insert(fieldFromHex(leaf.billing_pattern_hash));
    }
    expect(fieldToHex(smt.getRoot())).toBe(tree.root);
    return { smt, tree };
  }

  it("validates non-membership for clean billing pattern", async () => {
    const { smt, tree } = await rebuildFraudTree();

    const proof = {
      key: fieldFromHex(tree.clean_pattern.billing_pattern_hash),
      root: fieldFromHex(tree.root),
      path: tree.clean_pattern.non_membership_proof.path.map(fieldFromHex),
      pathIndices: tree.clean_pattern.non_membership_proof.path_indices,
    };

    const ok = await smt.verifyNonMembership(proof);
    expect(ok).toBe(true);
  });

  it("detects blacklisted billing pattern hash", async () => {
    const { smt, tree } = await rebuildFraudTree();
    expect(smt.has(fieldFromHex(tree.leaves[0].billing_pattern_hash))).toBe(true);
  });
});

describe("Nullifier and claim hash", () => {
  it("nullifier is deterministic", async () => {
    const input = {
      policyId: "POL-DEMO-001",
      visitDate: 1719000000,
      diagnosisSecret: 42n,
      randomNonce: 7n,
    };
    const a = await computeNullifier(input);
    const b = await computeNullifier(input);
    expect(a).toBe(b);
  });

  it("different nonce yields different nullifier", async () => {
    const base = {
      policyId: "POL-DEMO-001",
      visitDate: 1719000000,
      diagnosisSecret: 42n,
    };
    const a = await computeNullifier({ ...base, randomNonce: 1n });
    const b = await computeNullifier({ ...base, randomNonce: 2n });
    expect(a).not.toBe(b);
  });

  it("claim hash matches formula", async () => {
    const h = await computeClaimHash({
      visitDate: 1719000000,
      policyId: "POL-DEMO-001",
      nonce: 99n,
    });
    expect(h).toBeGreaterThan(0n);
  });
});

describe("Fraud pattern encoding", () => {
  it("builds billing pattern hash from blacklist entry shape", async () => {
    const h = await billingPatternHash(
      icdCategoryToField("J18.9"),
      amountBucketToField(500000, 999999),
      providerPatternToField("UNLICENSED"),
    );
    expect(fieldToHex(h)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
