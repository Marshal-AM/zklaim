import { useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { generateBoxKeypair } from "../lib/claimToken";
import { env } from "../config/env";
import { freighterSignMessage } from "../lib/freighter";
import { randomFieldHex } from "../lib/hydrateClaim";
import { registerPatientProfile } from "../lib/patientProfile";
import { savePatientIdentity } from "../lib/persistence";
import { usePatientStore, type PatientIdentity } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import { SectionCard } from "../components/ui/SectionCard";
import { toast } from "../lib/toast";

export function OnboardingPanel() {
  const setIdentity = usePatientStore((s) => s.setIdentity);
  const [busy, setBusy] = useState(false);

  async function handleOnboard() {
    setBusy(true);
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
        toast.success(
          "Registered in ZKlaim directory. Doctors can find you by your Stellar address.",
        );
      } else {
        toast.success("Identity generated — share your encryption key with your doctor.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard
      label="Onboarding"
      title="Set up your ZKlaim identity"
    >
      <p className="text-sm text-muted-foreground">
        Connect Freighter (testnet), then generate your private policy secrets
        and encryption keys. Everything stays in your browser (OPFS).
        {env.isSupabaseEnabled()
          ? " Your public encryption key is registered so doctors can send claims by Stellar address only."
          : ""}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={handleOnboard}
        className="btn-primary"
      >
        {busy ? "Setting up…" : "Connect & Generate Identity"}
      </button>
      <p className="text-xs text-subtle">
        Click your address in the header to connect Freighter, fund testnet XLM,
        and enable your USDC trustline before submitting claims.
      </p>
    </SectionCard>
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
