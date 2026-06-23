import { describe, expect, it } from "vitest";
import {
  encryptClaimToken,
  generateBoxKeypair,
  type ClaimTokenPayload,
} from "./claimToken";
import {
  importClaimToInbox,
  formatVisitDate,
  shortClaimId,
} from "./claimInbox";
import type { PatientIdentity } from "../types/patient";

function demoIdentity(box: ReturnType<typeof generateBoxKeypair>): PatientIdentity {
  return {
    policy_secret: "0x01",
    diagnosis_secret: "0x02",
    box_public_key: box.publicKey,
    box_secret_key: box.secretKey,
    deductible_limit_cents: 100_000,
    accumulator_met_cents: 80_000,
    policy_id: "DEMO-POLICY-001",
  };
}

function demoPayload(nonce: string): ClaimTokenPayload {
  return {
    version: 1,
    patientAddress: "GTEST",
    icd_code: "J18.9",
    amount_cents: 120000,
    visit_date: 20260623,
    policy_id: "DEMO-POLICY-001",
    nonce,
    policy_floor_cents: 100,
    policy_ceiling_cents: 50000,
    doctor_license_id: "MD-001",
    blinding_factor: "0xabcd",
    doctor_address: "GDOCTOR",
    doctor_signature: "sig",
  };
}

describe("claimInbox", () => {
  it("imports encrypted claim into inbox", async () => {
    const box = generateBoxKeypair();
    const identity = demoIdentity(box);
    const payload = demoPayload("0xnonce1");
    const token = await encryptClaimToken(payload, box.publicKey);

    const result = importClaimToInbox(token, identity, [], "delivery-uuid");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.entry.id).toBe("0xnonce1");
    expect(result.entry.deliveryId).toBe("delivery-uuid");
    expect(result.entry.status).toBe("pending");
  });

  it("dedupes by claim nonce", async () => {
    const box = generateBoxKeypair();
    const identity = demoIdentity(box);
    const payload = demoPayload("0xnonce2");
    const token = await encryptClaimToken(payload, box.publicKey);

    const first = importClaimToInbox(token, identity, []);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = importClaimToInbox(token, identity, [first.entry]);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.reason).toBe("duplicate");
  });

  it("formats visit date and short id", () => {
    expect(formatVisitDate(20260623)).toBe("2026-06-23");
    expect(shortClaimId("0xabcdef1234567890")).toMatch(/^0xabcdef12/);
  });
});
