import { describe, expect, it } from "vitest";
import { explainSubmitClaimError } from "./submitClaimErrors";

describe("explainSubmitClaimError", () => {
  it("maps update_accumulator failures to accumulator guidance", () => {
    const err = explainSubmitClaimError(
      'Simulation failed: HostError... update_accumulator ... InvalidAction',
    );
    expect(err.toast).toContain("Deductible accumulator");
    expect(err.invalidateAlignment).toBe(false);
  });

  it("maps asp root mismatch to redeploy hint", () => {
    const err = explainSubmitClaimError("asp root mismatch");
    expect(err.toast).toContain("ASP");
    expect(err.invalidateAlignment).toBe(true);
  });

  it("does not mislabel generic get_root host traces as ASP", () => {
    const err = explainSubmitClaimError(
      "UnreachableCodeReached submit_claim get_root coverage",
    );
    expect(err.toast).not.toContain("Doctor registry");
  });
});
