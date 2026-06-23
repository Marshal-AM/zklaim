/** Demo policy amount band — keep in sync with scripts/seed/demo_claim.json demo_a. */

/** Minimum covered claim: $1.00 */
export const DEMO_POLICY_FLOOR_CENTS = 100;

/** Maximum covered claim: $500.00 */
export const DEMO_POLICY_CEILING_CENTS = 50_000;

/** Fraud-tree billing bucket for licensed J18.9 visits (matches policy band). */
export const DEMO_BILLING_BUCKET_MIN = DEMO_POLICY_FLOOR_CENTS;
export const DEMO_BILLING_BUCKET_MAX = DEMO_POLICY_CEILING_CENTS;

export const DEMO_DEFAULT_AMOUNT_USD = "1";

export function formatDemoPolicyRange(): string {
  return `$${(DEMO_POLICY_FLOOR_CENTS / 100).toFixed(2)}–$${(DEMO_POLICY_CEILING_CENTS / 100).toFixed(2)}`;
}

/** Use current demo bounds for proving (tokens may carry stale floor/ceiling). */
export function resolveDemoPolicyBounds(payload: {
  policy_floor_cents: number;
  policy_ceiling_cents: number;
}): {
  policy_floor_cents: number;
  policy_ceiling_cents: number;
  wasStale: boolean;
} {
  const wasStale =
    payload.policy_floor_cents !== DEMO_POLICY_FLOOR_CENTS ||
    payload.policy_ceiling_cents !== DEMO_POLICY_CEILING_CENTS;
  return {
    policy_floor_cents: DEMO_POLICY_FLOOR_CENTS,
    policy_ceiling_cents: DEMO_POLICY_CEILING_CENTS,
    wasStale,
  };
}
