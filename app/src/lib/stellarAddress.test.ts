import { describe, expect, it } from "vitest";
import {
  normalizeStellarAddress,
  tryNormalizeStellarAddress,
} from "./stellarAddress";

const DEMO_PATIENT = "GAQ5S6CJWD5K4SAKNSYUEOAB7FT2JFUJY4XSZWKODS2NLHMN3IS467O6";

describe("stellarAddress", () => {
  it("normalizes valid G-address", () => {
    expect(normalizeStellarAddress(`  ${DEMO_PATIENT}  `)).toBe(DEMO_PATIENT);
  });

  it("returns null for invalid address", () => {
    expect(tryNormalizeStellarAddress("not-an-address")).toBeNull();
    expect(tryNormalizeStellarAddress(null)).toBeNull();
  });
});
