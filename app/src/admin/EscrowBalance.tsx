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
    <div className="space-y-2">
      <p className="text-sm text-slate-400">
        Insurer escrow ({env.insurerFundAddress().slice(0, 8)}…)
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {balance !== null && (
        <p className="text-2xl font-semibold text-emerald-400">
          {formatUsdc(balance)} USDC
        </p>
      )}
      <p className="text-xs text-slate-500">
        Top up via{" "}
        <code className="text-slate-400">bash scripts/fund_usdc.sh</code> on
        testnet.
      </p>
    </div>
  );
}
