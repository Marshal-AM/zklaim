import {
  hydrateClaimData,
  setCircuitLoader,
  setFraudTreeJson,
  setZkProofWorkerConstructors,
  type AspTreeArtifact,
  type PolicyTreeArtifact,
} from "@zklaim/proof-gen";
import { zkProofWorkerConstructors } from "./zkProofWorkers";
import { createFetchCircuitLoader } from "@zklaim/proof-gen/browserArtifacts";
import { fieldFromHex } from "@zklaim/scripts";
import type { ClaimTokenPayload } from "./claimToken";
import { env } from "../config/env";
import {
  DEMO_BILLING_BUCKET_MAX,
  DEMO_BILLING_BUCKET_MIN,
  resolveDemoPolicyBounds,
} from "../config/demoPolicy";
import type { PriorClaimContext } from "./accumulatorAlignment";
import type { PatientIdentity } from "../types/patient";
import { assertTreeChainAligned } from "./treeChainAlignment";
import { fetchJson } from "./fetchJson";

export { fetchJson };

let loadersInitialized = false;

export function initBrowserProofGen(): void {
  if (loadersInitialized) return;
  setCircuitLoader(createFetchCircuitLoader("/wasm"));
  setZkProofWorkerConstructors(zkProofWorkerConstructors);
  loadersInitialized = true;
}

export async function loadFraudTreeForBrowser(): Promise<void> {
  const tree = await fetchJson<Awaited<Parameters<typeof setFraudTreeJson>[0]>>(
    "/trees/fraud_tree.json",
  );
  setFraudTreeJson(tree);
}

export interface PendingClaimSecrets {
  random_nonce: string;
  blinding_factor: string;
}

export async function hydrateClaimFromToken(
  token: ClaimTokenPayload,
  identity: PatientIdentity,
  secrets: PendingClaimSecrets,
  priorClaim?: PriorClaimContext | null,
) {
  initBrowserProofGen();
  await loadFraudTreeForBrowser();
  await assertTreeChainAligned();

  const [policyTree, aspTree] = await Promise.all([
    fetchJson<PolicyTreeArtifact>("/trees/policy_tree.json"),
    fetchJson<AspTreeArtifact>("/trees/asp_tree.json"),
  ]);

  const policyBounds = resolveDemoPolicyBounds(token);

  return hydrateClaimData({
    icd_code: token.icd_code,
    amount_cents: token.amount_cents,
    visit_date: token.visit_date,
    policy_id: token.policy_id,
    nonce: fieldFromHex(token.nonce),
    policy_secret: fieldFromHex(identity.policy_secret),
    diagnosis_secret: fieldFromHex(identity.diagnosis_secret),
    random_nonce: fieldFromHex(secrets.random_nonce),
    policy_floor_cents: policyBounds.policy_floor_cents,
    policy_ceiling_cents: policyBounds.policy_ceiling_cents,
    blinding_factor: fieldFromHex(secrets.blinding_factor),
    accumulator: {
      prev_accumulator_secret: BigInt(identity.accumulator_met_cents),
      deductible_limit_cents: identity.deductible_limit_cents,
      blinding_factor: fieldFromHex(secrets.blinding_factor),
      prior_claim_amount: priorClaim?.amount_cents ?? 0,
      prior_claim_blinding: priorClaim
        ? fieldFromHex(priorClaim.blinding_factor)
        : 0n,
    },
    billing: {
      amount_bucket_min: DEMO_BILLING_BUCKET_MIN,
      amount_bucket_max: DEMO_BILLING_BUCKET_MAX,
      provider_pattern: "LICENSED",
    },
    insurer: env.insurerFundAddress(),
    doctor_license_id: token.doctor_license_id,
    policyTree,
    aspTree,
  });
}

export function randomFieldHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
