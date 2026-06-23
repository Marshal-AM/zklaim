import { describe, expect, it } from "vitest";
import { buildRegistrationMessage } from "./patientProfile";

describe("patientProfile", () => {
  it("builds registration message in canonical format", () => {
    const address = "GA6I4CLRAPBO3UK4U54ZV6CQZQ2HCGCFMDETDWQ4QIZRDPCF4AEP2JPJ";
    const boxKey = "dGVzdC1wdWJsaWMta2V5";
    expect(buildRegistrationMessage(address, boxKey)).toBe(
      `zklaim:register:v1:${address}:${boxKey}`,
    );
  });
});
