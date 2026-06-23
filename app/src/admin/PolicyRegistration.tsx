import { useEffect, useState } from "react";
import { fieldToHex, initPoseidon2, poseidon2HashFixed } from "@zklaim/scripts";
import { ensureWalletConnected } from "../components/WalletButton";
import { ErrorBanner } from "../components/ErrorBanner";
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
      {error && <ErrorBanner message={error} />}
      {txHash && (
        <p className="text-xs text-emerald-400 font-mono truncate">{txHash}</p>
      )}
      <p className="text-xs text-slate-500">
        Demo policy band: {formatDemoPolicyRange()}. Re-register after changing
        bounds so on-chain proofs match patient claims.
      </p>
      <input
        required
        placeholder="coverage_root (hex)"
        value={coverageRoot}
        onChange={(e) => setCoverageRoot(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
      />
      <input
        required
        placeholder="bounds_hash (hex)"
        value={boundsHash}
        onChange={(e) => setBoundsHash(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
      >
        register_policy
      </button>
    </form>
  );
}
