import { useState } from "react";
import { ensureWalletConnected } from "../components/WalletButton";
import { generateBoxKeypair } from "../lib/claimToken";
import { env } from "../config/env";
import { freighterSignMessage } from "../lib/freighter";
import { randomFieldHex } from "../lib/hydrateClaim";
import { registerPatientProfile } from "../lib/patientProfile";
import { savePatientIdentity } from "../lib/persistence";
import { usePatientStore, type PatientIdentity } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";

export function OnboardingPanel() {
  const setIdentity = usePatientStore((s) => s.setIdentity);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);

  async function handleOnboard() {
    setBusy(true);
    setError(null);
    setRegistered(false);
    try {
      const address = await ensureWalletConnected();
      const box = generateBoxKeypair();
      const identity: PatientIdentity = {
        policy_secret: randomFieldHex(),
        diagnosis_secret: randomFieldHex(),
        box_public_key: box.publicKey,
        box_secret_key: box.secretKey,
        deductible_limit_cents: 100_000,
        accumulator_met_cents: 80_000,
        policy_id: "DEMO-POLICY-001",
        stellar_address: address,
      };
      await savePatientIdentity(identity);
      setIdentity(identity);

      if (env.isSupabaseEnabled()) {
        await registerPatientProfile({
          address,
          boxPublicKey: box.publicKey,
          signMessage: freighterSignMessage,
        });
        setRegistered(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6 space-y-4">
      <h3 className="font-medium text-lg">Set up your ZKlaim identity</h3>
      <p className="text-sm text-slate-400">
        Connect Freighter (testnet), then generate your private policy secrets
        and encryption keys. Everything stays in your browser (OPFS).
        {env.isSupabaseEnabled()
          ? " Your public encryption key is registered so doctors can send claims by Stellar address only."
          : ""}
      </p>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {registered && (
        <p className="text-sm text-emerald-400">
          Registered in ZKlaim directory. Doctors can find you by your Stellar
          address.
        </p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={handleOnboard}
        className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
      >
        {busy ? "Setting up…" : "Connect & Generate Identity"}
      </button>
      <p className="text-xs text-slate-500">
        Use the header wallet button to connect Freighter, fund testnet XLM, and
        enable your USDC trustline before submitting claims.
      </p>
    </div>
  );
}

/** Re-register public key after wallet reconnect (e.g. if profile missing). */
export async function ensurePatientProfileRegistered(
  identity: PatientIdentity,
): Promise<void> {
  if (!env.isSupabaseEnabled()) return;
  const address = useWalletStore.getState().address;
  if (!address) return;
  await registerPatientProfile({
    address,
    boxPublicKey: identity.box_public_key,
    signMessage: freighterSignMessage,
  });
}
