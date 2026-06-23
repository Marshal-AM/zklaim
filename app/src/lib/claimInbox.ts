import {
  decryptClaimToken,
  verifyDoctorSignature,
  type EncryptedClaimToken,
} from "./claimToken";
import { formatUsdc } from "./balances";
import { randomFieldHex } from "./hydrateClaim";
import type { PatientIdentity, InboxClaim } from "../types/patient";

export type ImportClaimResult =
  | { ok: true; entry: InboxClaim; deliveryId?: string }
  | { ok: false; reason: "duplicate" | "invalid_signature" | "decrypt_failed" };

export function importClaimToInbox(
  token: EncryptedClaimToken,
  identity: PatientIdentity,
  inbox: InboxClaim[],
  deliveryId?: string,
): ImportClaimResult {
  let payload;
  try {
    payload = decryptClaimToken(token, identity.box_secret_key);
  } catch {
    return { ok: false, reason: "decrypt_failed" };
  }

  if (!verifyDoctorSignature(payload)) {
    return { ok: false, reason: "invalid_signature" };
  }

  const id = payload.nonce;
  if (inbox.some((c) => c.id === id)) {
    return { ok: false, reason: "duplicate" };
  }

  const entry: InboxClaim = {
    id,
    receivedAt: new Date().toISOString(),
    token,
    random_nonce: randomFieldHex(),
    blinding_factor: payload.blinding_factor,
    status: "pending",
    deliveryId,
  };

  return { ok: true, entry, deliveryId };
}

export interface InboxClaimSummary {
  amount_cents: number;
  amount_label: string;
  icd_code: string;
  visit_date: number;
  doctor_license_id: string;
}

export function summarizeInboxClaim(
  claim: InboxClaim,
  boxSecretKey: string,
): InboxClaimSummary | null {
  try {
    const payload = decryptClaimToken(claim.token, boxSecretKey);
    return {
      amount_cents: payload.amount_cents,
      amount_label: formatUsdc(payload.amount_cents),
      icd_code: payload.icd_code,
      visit_date: payload.visit_date,
      doctor_license_id: payload.doctor_license_id,
    };
  } catch {
    return null;
  }
}

export function formatVisitDate(visitDate: number): string {
  const s = String(visitDate);
  if (s.length !== 8) return s;
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function shortClaimId(id: string): string {
  if (id.length <= 18) return id;
  return `${id.slice(0, 10)}…${id.slice(-6)}`;
}
