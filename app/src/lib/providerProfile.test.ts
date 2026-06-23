import { describe, expect, it } from "vitest";
import {
  buildProviderRegistrationMessage,
  demoCredentialForLicense,
} from "./providerProfile";

describe("providerProfile", () => {
  it("builds provider registration message", () => {
    const address = "GA6I4CLRAPBO3UK4U54ZV6CQZQ2HCGCFMDETDWQ4QIZRDPCF4AEP2JPJ";
    expect(buildProviderRegistrationMessage(address, "MD-001")).toBe(
      `zklaim:provider:register:v1:${address}:MD-001`,
    );
  });

  it("returns demo credential for MD-001", () => {
    expect(demoCredentialForLicense("MD-001")).toEqual({
      license_id: "MD-001",
      specialty_code: "PULM",
      jurisdiction: "US-CA",
    });
  });
});
