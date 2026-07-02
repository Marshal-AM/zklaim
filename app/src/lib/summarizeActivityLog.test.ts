import { describe, expect, it } from "vitest";
import { summarizeActivityLog } from "./summarizeActivityLog";
import type { ActivityLogEntry } from "./activityLog";

function entry(
  partial: Partial<ActivityLogEntry> & Pick<ActivityLogEntry, "level" | "step">,
): ActivityLogEntry {
  return {
    id: partial.id ?? "e1",
    ts: partial.ts ?? Date.now(),
    level: partial.level,
    step: partial.step,
    detail: partial.detail,
    txHash: partial.txHash,
    explorerUrl: partial.explorerUrl,
  };
}

describe("summarizeActivityLog", () => {
  it("aggregates counts, duration, and headline from errors", () => {
    const entries: ActivityLogEntry[] = [
      entry({ id: "1", ts: 1000, level: "info", step: "Started" }),
      entry({ id: "2", ts: 2000, level: "success", step: "Proofs done" }),
      entry({
        id: "3",
        ts: 3000,
        level: "error",
        step: "Ledger rejected",
        txHash: "abc123",
      }),
    ];

    const summary = summarizeActivityLog(entries);

    expect(summary.total).toBe(3);
    expect(summary.durationMs).toBe(2000);
    expect(summary.byLevel.success).toBe(1);
    expect(summary.byLevel.error).toBe(1);
    expect(summary.headline).toBe("Ledger rejected");
    expect(summary.txHashes).toEqual(["abc123"]);
  });
});
