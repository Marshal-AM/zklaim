import { describe, expect, it } from "vitest";
import { explainPassportCredentialError } from "./passportContract";

describe("explainPassportCredentialError", () => {
  it("maps unreachable verify_credential trap to verifier guidance", () => {
    const msg = explainPassportCredentialError(
      'HostError: Error(WasmVm, InvalidAction) ... UnreachableCodeReached verify_credential',
    );
    expect(msg).toContain("not registered");
    expect(msg).toContain("VITE_DEPLOYER_SECRET_KEY");
  });

  it("passes through unknown errors", () => {
    expect(explainPassportCredentialError("custom")).toBe("custom");
  });
});
