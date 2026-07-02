import { Address } from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { fetchJson } from "./fetchJson";
import {
  normalizeRootHex,
  readContractRoot,
  readContractU32,
} from "./sorobanRead";

export interface TreeManifest {
  generated_at: string;
  merkle_depth: number;
  roots: {
    policy_coverage: string;
    physician_asp: string;
    fraud_asp: string;
  };
  demo?: {
    icd_code: string;
    enrolled_doctor_wallet?: string;
    unenrolled_doctor_wallet?: string;
    deductible_demo_threshold_cents?: number;
  };
}

export interface TreeArtifactRoots {
  policy: string;
  asp: string;
  fraud: string;
  aspDoctorCount: number;
}

export interface TreeMismatch {
  label: string;
  expected: string;
  actual: string;
}

export interface TreeAlignmentReport {
  aligned: boolean;
  manifestGeneratedAt: string;
  artifactRoots: TreeArtifactRoots;
  onChainRoots: {
    policy: string;
    asp: string;
    fraud: string;
    aspLeafCount: number;
  };
  mismatches: TreeMismatch[];
}

const ALIGNMENT_RECOVERY =
  "Run: npm run build:trees && npm run redeploy:asp-escrow — then restart npm run dev";

let cachedReport: TreeAlignmentReport | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export function formatTreeAlignmentError(report: TreeAlignmentReport): string {
  const lines = report.mismatches.map(
    (m) => `${m.label}: expected 0x${m.expected}, on-chain 0x${m.actual}`,
  );
  return [
    "Merkle trees are out of sync with Soroban contracts.",
    ...lines,
    ALIGNMENT_RECOVERY,
  ].join(" ");
}

export async function loadTreeManifest(): Promise<TreeManifest> {
  return fetchJson<TreeManifest>("/trees/manifest.json");
}

export async function loadArtifactRoots(): Promise<TreeArtifactRoots> {
  const [manifest, aspTree, policyTree, fraudTree] = await Promise.all([
    loadTreeManifest(),
    fetchJson<{ root: string; doctors: unknown[] }>("/trees/asp_tree.json"),
    fetchJson<{ root: string }>("/trees/policy_tree.json"),
    fetchJson<{ root: string }>("/trees/fraud_tree.json"),
  ]);

  const policyRoot = normalizeRootHex(manifest.roots.policy_coverage);
  const aspRoot = normalizeRootHex(manifest.roots.physician_asp);
  const fraudRoot = normalizeRootHex(manifest.roots.fraud_asp);

  const mismatches: string[] = [];
  if (normalizeRootHex(policyTree.root) !== policyRoot) {
    mismatches.push("policy_tree.json root does not match manifest");
  }
  if (normalizeRootHex(aspTree.root) !== aspRoot) {
    mismatches.push("asp_tree.json root does not match manifest");
  }
  if (normalizeRootHex(fraudTree.root) !== fraudRoot) {
    mismatches.push("fraud_tree.json root does not match manifest");
  }
  if (aspTree.doctors.length === 0) {
    mismatches.push("asp_tree.json has no enrolled doctors");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `${mismatches.join("; ")}. ${ALIGNMENT_RECOVERY}`,
    );
  }

  return {
    policy: policyRoot,
    asp: aspRoot,
    fraud: fraudRoot,
    aspDoctorCount: aspTree.doctors.length,
  };
}

export async function readOnChainTreeState(): Promise<{
  policy: string;
  asp: string;
  fraud: string;
  aspLeafCount: number;
}> {
  const insurer = env.insurerFundAddress();
  const [policy, asp, fraud, aspLeafCount] = await Promise.all([
    readContractRoot(
      env.policyRegistryId(),
      "get_coverage_root",
      [new Address(insurer).toScVal()],
    ),
    readContractRoot(env.aspMemberId()),
    readContractRoot(env.aspFraudId()),
    readContractU32(env.aspMemberId(), "leaf_count"),
  ]);
  return { policy, asp, fraud, aspLeafCount };
}

export async function verifyTreeChainAlignment(options?: {
  force?: boolean;
}): Promise<TreeAlignmentReport> {
  const now = Date.now();
  if (
    !options?.force &&
    cachedReport &&
    cachedReport.aligned &&
    now - cachedAt < CACHE_MS
  ) {
    return cachedReport;
  }

  const artifactRoots = await loadArtifactRoots();
  const onChainRoots = await readOnChainTreeState();

  const mismatches: TreeMismatch[] = [];
  const checks: Array<{
    label: string;
    expected: string;
    actual: string;
  }> = [
    {
      label: "Policy coverage root",
      expected: artifactRoots.policy,
      actual: onChainRoots.policy,
    },
    {
      label: "Physician ASP root",
      expected: artifactRoots.asp,
      actual: onChainRoots.asp,
    },
    {
      label: "Fraud ASP root",
      expected: artifactRoots.fraud,
      actual: onChainRoots.fraud,
    },
  ];

  for (const check of checks) {
    if (check.expected !== check.actual) {
      mismatches.push(check);
    }
  }

  if (onChainRoots.aspLeafCount !== artifactRoots.aspDoctorCount) {
    mismatches.push({
      label: "ASP enrolled doctor count",
      expected: String(artifactRoots.aspDoctorCount),
      actual: String(onChainRoots.aspLeafCount),
    });
  }

  const manifest = await loadTreeManifest();
  const report: TreeAlignmentReport = {
    aligned: mismatches.length === 0,
    manifestGeneratedAt: manifest.generated_at,
    artifactRoots,
    onChainRoots,
    mismatches,
  };

  cachedReport = report;
  cachedAt = now;
  return report;
}

export function invalidateTreeAlignmentCache(): void {
  cachedReport = null;
  cachedAt = 0;
}

export async function assertTreeChainAligned(options?: {
  force?: boolean;
}): Promise<TreeAlignmentReport> {
  const report = await verifyTreeChainAlignment(options);
  if (!report.aligned) {
    throw new Error(formatTreeAlignmentError(report));
  }
  return report;
}
