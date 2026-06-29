import { useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { FormField } from "../components/ui/FormField";
import { insertFraudPattern } from "../lib/contracts";
import { toast } from "../lib/toast";

export function FraudPatterns() {
  const [patternHash, setPatternHash] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const admin = await ensureWalletConnected();
      const result = await insertFraudPattern({
        admin,
        patternHash,
      });
      setTxHash(result.hash);
      toast.success("Fraud pattern inserted on-chain");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Insert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {txHash ? (
        <p className="text-safe-mono text-xs text-success">{txHash}</p>
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
