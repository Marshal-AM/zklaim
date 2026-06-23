import { describe, expect, it } from "vitest";
import {
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  resolveDemoPolicyBounds,
} from "./demoPolicy";

describe("demoPolicy", () => {
  it("normalizes stale token bounds to current demo policy", () => {
    const result = resolveDemoPolicyBounds({
      policy_floor_cents: 10000,
      policy_ceiling_cents: 500000,
    });
    expect(result.wasStale).toBe(true);
    expect(result.policy_floor_cents).toBe(DEMO_POLICY_FLOOR_CENTS);
    expect(result.policy_ceiling_cents).toBe(DEMO_POLICY_CEILING_CENTS);
  });

  it("leaves current bounds unchanged", () => {
    const result = resolveDemoPolicyBounds({
      policy_floor_cents: DEMO_POLICY_FLOOR_CENTS,
      policy_ceiling_cents: DEMO_POLICY_CEILING_CENTS,
    });
    expect(result.wasStale).toBe(false);
  });
});
