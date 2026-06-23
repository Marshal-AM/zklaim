import { useEffect, useState } from "react";
import { fieldToHex, initPoseidon2, poseidon2HashFixed } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/ui/FormField";
import { registerPolicy } from "../lib/contracts";
import { fetchJson } from "../lib/hydrateClaim";
import {
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  formatDemoPolicyRange,
} from "../config/demoPolicy";

export function PolicyRegistration() {
  const [coverageRoot, setCoverageRoot] = useState("");
  const [boundsHash, setBoundsHash] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchJson<{ root: string }>("/trees/policy_tree.json").then((t) =>
      setCoverageRoot(t.root.replace(/^0x/, "")),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      await initPoseidon2();
      const hash = await poseidon2HashFixed([
        BigInt(DEMO_POLICY_FLOOR_CENTS),
        BigInt(DEMO_POLICY_CEILING_CENTS),
      ]);
      setBoundsHash(fieldToHex(hash).replace(/^0x/, ""));
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const insurer = await ensureWalletConnected();
      const result = await registerPolicy({
        insurer,
        coverageRoot,
        boundsHash,
        expiryLedger: 4_000_000_000,
      });
      setTxHash(result.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
      <p className="text-xs text-muted-foreground">
        Demo policy band: {formatDemoPolicyRange()}. Re-register after changing
        bounds so on-chain proofs match patient claims.
      </p>
      <FormField label="Coverage root (hex)">
        <input
          required
          value={coverageRoot}
          onChange={(e) => setCoverageRoot(e.target.value)}
          className="input-field font-mono"
        />
      </FormField>
      <FormField label="Bounds hash (hex)">
        <input
          required
          value={boundsHash}
          onChange={(e) => setBoundsHash(e.target.value)}
          className="input-field font-mono"
        />
      </FormField>
      <button type="submit" disabled={busy} className="btn-secondary">
        register_policy
      </button>
    </form>
  );
}
