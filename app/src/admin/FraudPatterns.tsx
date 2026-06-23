import { useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/ui/FormField";
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
      {error ? <ErrorBanner message={error} /> : null}
      {txHash ? (
        <p className="truncate font-mono text-xs text-success">{txHash}</p>
      ) : null}
      <FormField label="Billing pattern hash (hex)">
        <input
          required
          value={patternHash}
          onChange={(e) => setPatternHash(e.target.value)}
          className="input-field font-mono"
          placeholder="billing_pattern_hash"
        />
      </FormField>
      <button type="submit" disabled={busy} className="btn-secondary">
        insert_pattern
      </button>
    </form>
  );
}
