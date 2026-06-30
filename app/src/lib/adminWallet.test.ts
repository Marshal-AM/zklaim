import { afterEach, describe, expect, it, vi } from "vitest";
import { hasAdminSigningKey, requireAdminSigning } from "./adminWallet";

describe("adminWallet", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hasAdminSigningKey is false when unset", () => {
    vi.stubEnv("VITE_DEPLOYER_SECRET_KEY", "");
    expect(hasAdminSigningKey()).toBe(false);
  });

  it("hasAdminSigningKey is true when secret is set", () => {
    vi.stubEnv("VITE_DEPLOYER_SECRET_KEY", "S" + "A".repeat(55));
    expect(hasAdminSigningKey()).toBe(true);
  });

  it("requireAdminSigning throws when secret missing", () => {
    vi.stubEnv("VITE_DEPLOYER_SECRET_KEY", "");
    expect(() => requireAdminSigning()).toThrow(/VITE_DEPLOYER_SECRET_KEY/);
  });
});
