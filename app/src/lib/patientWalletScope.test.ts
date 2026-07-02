import { describe, expect, it } from "vitest";
import {
  identityMatchesWallet,
  patientScopedOpfsKey,
  patientWalletId,
} from "./patientWalletScope";

const WALLET_A = "GBEQTRDIJYZPZG6OUIILUE5Z57RLMAWDF63BDAXENFD3CHP2XU2EYC7A";
const WALLET_B = "GBBZO2I4KSUO7IX7VXQZJHJF53N4QCU734TTSEGO4N5U2XBI3VQ4N2QD";

describe("patientWalletScope", () => {
  it("normalizes wallet ids consistently", () => {
    expect(patientWalletId(WALLET_A)).toBe(WALLET_A);
  });

  it("builds scoped OPFS keys per wallet", () => {
    expect(patientScopedOpfsKey(WALLET_A, "identity.json")).toBe(
      `patient_${WALLET_A}_identity.json`,
    );
    expect(patientScopedOpfsKey(WALLET_B, "inbox.json")).not.toBe(
      patientScopedOpfsKey(WALLET_A, "inbox.json"),
    );
  });

  it("matches identity to wallet", () => {
    expect(
      identityMatchesWallet({ stellar_address: WALLET_A }, WALLET_A),
    ).toBe(true);
    expect(
      identityMatchesWallet({ stellar_address: WALLET_B }, WALLET_A),
    ).toBe(false);
  });
});
