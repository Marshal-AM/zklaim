import { useState } from "react";
import { ensureWalletConnected } from "../components/WalletButton";
import { ErrorBanner } from "../components/ErrorBanner";
import { insertFraudPattern } from "../lib/contracts";

export function FraudPatterns() {
  const [patternHash, setPatternHash] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const admin = await ensureWalletConnected();
      const result = await insertFraudPattern({
        admin,
        patternHash,
      });
      setTxHash(result.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Insert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <ErrorBanner message={error} />}
      {txHash && (
        <p className="text-xs text-emerald-400 font-mono truncate">{txHash}</p>
      )}
      <input
        required
        placeholder="billing_pattern_hash (hex)"
        value={patternHash}
        onChange={(e) => setPatternHash(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
      >
        insert_pattern
      </button>
    </form>
  );
}
