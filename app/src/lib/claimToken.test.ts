import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";
import {
  encryptClaimToken,
  decryptClaimToken,
  generateBoxKeypair,
  type ClaimTokenPayload,
} from "./claimToken";

describe("claimToken", () => {
  it("roundtrips encrypt/decrypt", async () => {
    const box = generateBoxKeypair();
    const payload: ClaimTokenPayload = {
      version: 1,
      patientAddress: "GTEST",
      icd_code: "J18.9",
      amount_cents: 120000,
      visit_date: 20260623,
      policy_id: "DEMO-POLICY-001",
      nonce: "0x1234",
    policy_floor_cents: 100,
    policy_ceiling_cents: 50000,
      doctor_license_id: "MD-001",
      blinding_factor: "0xabcd",
      doctor_address: "GDOCTOR",
      doctor_signature: "sig",
    };

    const encrypted = await encryptClaimToken(payload, box.publicKey);
    const decrypted = decryptClaimToken(encrypted, box.secretKey);
    expect(decrypted.icd_code).toBe("J18.9");
    expect(decrypted.amount_cents).toBe(120000);
    expect(encrypted.cid).toMatch(/^zklaim:\/\/sha256\//);
  });

  it("attaches insurer view envelope when configured", async () => {
    const box = generateBoxKeypair();
    const insurer = generateBoxKeypair();
    const payload: ClaimTokenPayload = {
      version: 1,
      patientAddress: "GTEST",
      icd_code: "J18.9",
      amount_cents: 120000,
      visit_date: 20260623,
      policy_id: "DEMO-POLICY-001",
      nonce: "0x1234",
      policy_floor_cents: 100,
      policy_ceiling_cents: 50000,
      doctor_license_id: "MD-001",
      blinding_factor: "0xabcd",
      doctor_address: "GDOCTOR",
      doctor_signature: "sig",
    };

    const encrypted = await encryptClaimToken(payload, box.publicKey, {
      insurerViewPublicKey: insurer.publicKey,
    });
    expect(encrypted.insurer_view).toBeDefined();
    expect(encrypted.insurer_view?.ciphertext.length).toBeGreaterThan(0);
  });

  it("generates valid box keypair", () => {
    const kp = generateBoxKeypair();
    const pub = nacl.box.keyPair.fromSecretKey(decodeBase64(kp.secretKey));
    expect(encodeBase64(pub.publicKey)).toBe(kp.publicKey);
  });
});
