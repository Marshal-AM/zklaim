import { describe, expect, it } from "vitest";
import { generateBoxKeypair, encryptClaimToken } from "./claimToken";
import { parseClaimTokenInput } from "./parseClaimTokenInput";
import { encodeTokenForUrl } from "./claimToken";

describe("parseClaimTokenInput", () => {
  it("parses JSON encrypted token", async () => {
    const patient = generateBoxKeypair();
    const insurer = generateBoxKeypair();
    const encrypted = await encryptClaimToken(
      {
        version: 1,
        patientAddress: "GTEST",
        icd_code: "J18.9",
        amount_cents: 5000,
        visit_date: 20260623,
        policy_id: "DEMO",
        nonce: "abc",
        policy_floor_cents: 0,
        policy_ceiling_cents: 100000,
        doctor_license_id: "MD-1",
        blinding_factor: "bf",
        doctor_address: "GDOCTOR",
        doctor_signature: "sig",
      },
      patient.publicKey,
      { insurerViewPublicKey: insurer.publicKey },
    );
    const json = JSON.stringify(encrypted);
    const parsed = parseClaimTokenInput(json);
    expect(parsed.cid).toBe(encrypted.cid);
    expect(parsed.insurer_view).toBeDefined();
  });

  it("parses deep link URL with claim param", async () => {
    const patient = generateBoxKeypair();
    const encrypted = await encryptClaimToken(
      {
        version: 1,
        patientAddress: "GTEST",
        icd_code: "J18.9",
        amount_cents: 5000,
        visit_date: 20260623,
        policy_id: "DEMO",
        nonce: "abc",
        policy_floor_cents: 0,
        policy_ceiling_cents: 100000,
        doctor_license_id: "MD-1",
        blinding_factor: "bf",
        doctor_address: "GDOCTOR",
        doctor_signature: "sig",
      },
      patient.publicKey,
    );
    const encoded = encodeTokenForUrl(encrypted);
    const url = `http://localhost:5173/?claim=${encoded}`;
    const parsed = parseClaimTokenInput(url);
    expect(parsed.ciphertext).toBe(encrypted.ciphertext);
  });
});
