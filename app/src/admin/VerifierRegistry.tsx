import { useState } from "react";
import { useWalletStore } from "../store/wallet";
import { registerPassportVerifier } from "../lib/passportContract";
import { isPassportConfigured } from "../lib/passportContract";
import { FormField } from "../components/ui/FormField";
import { toast } from "../lib/toast";

export function VerifierRegistry() {
  const admin = useWalletStore((s) => s.address);
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);

  if (!isPassportConfigured()) {
    return (
      <p className="text-sm text-muted-foreground">
        Set <code className="text-subtle">VITE_PASSPORT_REGISTRY_CONTRACT_ID</code>{" "}
        after deploying passport_registry.
      </p>
    );
  }

  async function handleRegister() {
    if (!admin || !verifier.trim()) {
      toast.error("Connect admin wallet and enter verifier address.");
      return;
    }
    setBusy(true);
    try {
      const result = await registerPassportVerifier({
        admin,
        verifier: verifier.trim(),
        permitted: true,
      });
      toast.success(`Verifier registered. Tx: ${result.hash.slice(0, 16)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <FormField label="Verifier Stellar address">
        <input
          className="input-field-lg font-mono"
          value={verifier}
          onChange={(e) => setVerifier(e.target.value)}
          placeholder="G…"
        />
      </FormField>
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
