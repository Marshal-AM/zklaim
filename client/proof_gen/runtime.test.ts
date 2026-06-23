import { describe, expect, it } from "vitest";
import { isNodeRuntime } from "./runtime.js";

describe("runtime", () => {
  it("detects Node in vitest", () => {
    expect(isNodeRuntime()).toBe(true);
  });
});
