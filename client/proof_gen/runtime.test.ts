import { describe, expect, it } from "vitest";
import { isNodeRuntime, normalizeProverError } from "./runtime.js";

describe("runtime", () => {
  it("detects Node in vitest", () => {
    expect(isNodeRuntime()).toBe(true);
  });

  it("normalizes worker ErrorEvent-like objects", () => {
    const err = normalizeProverError({
      message: "",
      filename: "https://example.com/assets/policy.worker.js",
      lineno: 1,
      colno: 2,
    });
    expect(err.message).toContain("policy.worker.js:1:2");
  });
});
