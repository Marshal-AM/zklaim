import type { EncryptedClaimToken } from "../lib/claimToken";

export interface PatientIdentity {
  policy_secret: string;
  diagnosis_secret: string;
  box_public_key: string;
  box_secret_key: string;
  deductible_limit_cents: number;
  accumulator_met_cents: number;
  policy_id: string;
}

export interface InboxClaim {
  id: string;
  receivedAt: string;
  token: EncryptedClaimToken;
  random_nonce: string;
  blinding_factor: string;
  status: "pending" | "submitted" | "failed";
  deliveryId?: string;
}

export interface ClaimHistoryEntry {
  nullifier: string;
  submittedAt: string;
  txHash?: string;
}
