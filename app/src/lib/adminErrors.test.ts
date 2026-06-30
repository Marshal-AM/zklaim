import { describe, expect, it } from "vitest";
import { explainAdminContractError } from "./adminErrors";

describe("explainAdminContractError", () => {
  it("maps register_verifier trap to admin wallet guidance", () => {
    const msg = explainAdminContractError(
      "HostError: UnreachableCodeReached register_verifier",
    );
    expect(msg).toContain("VITE_DEPLOYER_SECRET_KEY");
  });
});
