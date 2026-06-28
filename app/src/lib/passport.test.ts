import { describe, expect, it } from "vitest";
import {
  bucketAmountCents,
  formatAmountBucketLabel,
  icdLetterFromCode,
  visitMonthFromDate,
} from "./passport";

describe("passport leaf helpers", () => {
  it("extracts single-letter ICD category", () => {
    expect(icdLetterFromCode("J18.9")).toBe("J");
    expect(icdLetterFromCode("f32")).toBe("F");
  });

  it("buckets amount to $500 steps in cents", () => {
    expect(bucketAmountCents(124_700)).toBe(100_000);
    expect(bucketAmountCents(49_999)).toBe(0);
    expect(bucketAmountCents(50_000)).toBe(50_000);
  });

  it("formats bucket label", () => {
    expect(formatAmountBucketLabel(100_000)).toBe("$1000–$1500");
  });

  it("computes visit month from unix seconds", () => {
    const march2026 = Math.floor(Date.UTC(2026, 2, 14) / 1000);
    expect(visitMonthFromDate(march2026)).toBe(2026 * 12 + 2);
  });

  it("computes visit month from YYYYMMDD", () => {
    expect(visitMonthFromDate(20260627)).toBe(2026 * 12 + 5);
  });
});
