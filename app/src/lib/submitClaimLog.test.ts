import { describe, expect, it } from "vitest";
import {
  createSubmitClaimLogger,
  formatSubmitClaimData,
} from "./submitClaimLog";

describe("submitClaimLog", () => {
  it("formats bigint values in log data", () => {
    expect(formatSubmitClaimData({ n: 42n })).toBe('{\n  "n": "42"\n}');
  });

  it("collects entries and invokes callback", () => {
    const seen: string[] = [];
    const log = createSubmitClaimLogger((entry) => {
      seen.push(entry.step);
    });

    log.info("wallet connected", { address: "GABC" });
    log.success("proofs complete");
    log.error("submit failed", new Error("boom"));

    expect(seen).toEqual([
      "wallet connected",
      "proofs complete",
      "submit failed",
    ]);
    expect(log.getEntries()).toHaveLength(3);
    expect(log.getEntries()[2].level).toBe("error");
    expect(log.getEntries()[2].detail).toContain("boom");
  });

  it("clears collected entries", () => {
    const log = createSubmitClaimLogger(() => undefined);
    log.info("step");
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });
});
