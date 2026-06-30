import { useCallback, useMemo, useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { FormField } from "../components/ui/FormField";
import { ActivityLogPanel } from "../components/ActivityLogPanel";
import { insertFraudPattern } from "../lib/contracts";
import { createActivityLogger, type ActivityLogEntry } from "../lib/activityLog";
import { toast } from "../lib/toast";

export function FraudPatterns() {
  const [patternHash, setPatternHash] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const appendLog = useCallback((e: ActivityLogEntry) => {
    setLogEntries((prev) => [...prev, e]);
  }, []);
  const log = useMemo(
    () => createActivityLogger(appendLog, { prefix: "[ZKlaim Admin]" }),
    [appendLog],
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLogEntries([]);
    log.clear();
    log.info("insert_pattern started", { patternHash });
    try {
      const admin = await ensureWalletConnected();
      log.success("Admin wallet connected", { admin });
      const result = await insertFraudPattern({
        admin,
        patternHash,
        log,
      });
      setTxHash(result.hash);
      toast.success("Fraud pattern inserted on-chain");
    } catch (err) {
      log.error("insert_pattern failed", err);
      toast.error(err instanceof Error ? err.message : "Insert failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {txHash ? (
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-safe-mono text-xs text-success underline"
        >
          {txHash}
        </a>
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
      <ActivityLogPanel entries={logEntries} title="Admin activity log" />
    </form>
  );
}
