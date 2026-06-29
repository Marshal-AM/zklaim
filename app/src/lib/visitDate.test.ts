import { describe, expect, it } from "vitest";
import {
  displayToVisitYmd,
  formatVisitDateTyping,
  isValidVisitYmd,
  nativeValueToVisitYmd,
  partsToYmd,
  visitYmdToDisplay,
  visitYmdToNumber,
} from "./visitDate";

describe("visitDate", () => {
  it("formats and parses YYYYMMDD ↔ YYYY-MM-DD", () => {
    expect(visitYmdToDisplay("20260629")).toBe("2026-06-29");
    expect(displayToVisitYmd("2026-06-29")).toBe("20260629");
    expect(nativeValueToVisitYmd("2026-06-29")).toBe("20260629");
  });

  it("formats typing progressively", () => {
    expect(formatVisitDateTyping("2026")).toBe("2026");
    expect(formatVisitDateTyping("202606")).toBe("2026-06");
    expect(formatVisitDateTyping("20260629")).toBe("2026-06-29");
  });

  it("rejects invalid calendar dates", () => {
    expect(isValidVisitYmd("20260230")).toBe(false);
    expect(isValidVisitYmd("20260629")).toBe(true);
    expect(displayToVisitYmd("2026-02-30")).toBe(null);
  });

  it("builds YYYYMMDD from parts without timezone drift", () => {
    expect(partsToYmd(2026, 6, 29)).toBe("20260629");
    expect(visitYmdToNumber("20260629")).toBe(20260629);
  });
});
