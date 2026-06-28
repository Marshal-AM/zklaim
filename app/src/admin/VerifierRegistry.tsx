import { useState } from "react";
import { useWalletStore } from "../store/wallet";
import { registerPassportVerifier } from "../lib/passportContract";
import { isPassportConfigured } from "../lib/passportContract";
import { ErrorBanner } from "../components/ErrorBanner";

export function VerifierRegistry() {
  const admin = useWalletStore((s) => s.address);
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isPassportConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Set <code className="text-subtle">VITE_PASSPORT_REGISTRY_CONTRACT_ID</code>{" "}
        after deploying passport_registry.
      </p>
    );
  }

  async function handleRegister() {
    if (!admin || !verifier.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await registerPassportVerifier({
        admin,
        verifier: verifier.trim(),
        permitted: true,
      });
      setMessage(`Verifier registered. Tx: ${result.hash}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-muted-foreground">Verifier Stellar address</span>
        <input
          className="input-field mt-1"
          value={verifier}
          onChange={(e) => setVerifier(e.target.value)}
          placeholder="G..."
        />
      </label>
      {error ? <ErrorBanner message={error} /> : null}
      {message ? <p className="text-sm text-success">{message}</p> : null}
      <button
        type="button"
        onClick={() => void handleRegister()}
        disabled={busy || !admin}
        className="btn-primary"
      >
        {busy ? "Registering…" : "Register verifier on Stellar"}
      </button>
    </div>
  );
}
