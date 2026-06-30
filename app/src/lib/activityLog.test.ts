import { describe, expect, it } from "vitest";
import {
  createActivityLogger,
  stellarExpertTxUrl,
} from "./activityLog";

describe("activityLog", () => {
  it("collects entries and formats tx links", () => {
    const collected: unknown[] = [];
    const log = createActivityLogger((entry) => {
      collected.push(entry);
    });

    log.info("step one", { ok: true });
    log.tx("confirmed", "abc123hash", { status: "SUCCESS" });
    log.error("failed", new Error("boom"));

    expect(collected).toHaveLength(3);
    expect(log.getEntries()).toHaveLength(3);
    const txEntry = log.getEntries()[1];
    expect(txEntry.explorerUrl).toBe(stellarExpertTxUrl("abc123hash"));
    expect(log.getEntries()[2].level).toBe("error");
  });

  it("clears entries", () => {
    const log = createActivityLogger(() => undefined);
    log.info("step");
    log.clear();
    expect(log.getEntries()).toHaveLength(0);
  });
});
