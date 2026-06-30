import { useEffect, useState } from "react";
import { fetchUsdcBalance, formatUsdc } from "../lib/balances";
import { env } from "../config/env";

export function EscrowBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchUsdcBalance(env.insurerFundAddress())
      .then(setBalance)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Balance fetch failed"),
      );
  }, []);

  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Insurer escrow · {env.insurerFundAddress().slice(0, 8)}…
        </p>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : balance !== null ? (
          <p className="text-3xl font-[650] tabular-nums tracking-tight text-primary">
            {formatUsdc(balance)}{" "}
            <span className="text-sm font-medium text-muted-foreground">USDC</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Loading balance…</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Available for claim escrow payouts on testnet.
      </p>
    </div>
  );
}
