import { describe, expect, it } from "vitest";
import { env } from "./env";

describe("env", () => {
  it("has default rpc url", () => {
    expect(env.rpcUrl).toContain("stellar");
  });

  it("reads vite contract ids when set", () => {
    expect(() => env.claimEscrowId()).not.toThrow();
  });
});
