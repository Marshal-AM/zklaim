import { describe, expect, it } from "vitest";
import nacl from "tweetnacl";
import { encodeBase64 } from "tweetnacl-util";
import {
  decryptInsurerView,
  encryptForInsurerView,
} from "./viewKey";
import { generateBoxKeypair } from "./claimToken";

describe("viewKey", () => {
  it("roundtrips insurer selective-disclosure envelope", () => {
    const insurer = generateBoxKeypair();
    const plaintext = JSON.stringify({ icd_code: "J18.9", amount_cents: 100 });
    const envelope = encryptForInsurerView(plaintext, insurer.publicKey);
    const opened = decryptInsurerView(envelope, insurer.secretKey);
    expect(opened).toBe(plaintext);
  });

  it("rejects invalid insurer public key length", () => {
    const badKey = encodeBase64(nacl.randomBytes(16));
    expect(() =>
      encryptForInsurerView("{}", badKey),
    ).toThrow(/Invalid insurer view public key/);
  });
});
