import { useCallback, useMemo, useState } from "react";
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
import { ActivityLogPanel } from "../components/ActivityLogPanel";
import { createActivityLogger, type ActivityLogEntry } from "../lib/activityLog";
import { toast } from "../lib/toast";

export function OnboardingPanel() {
  const setIdentity = usePatientStore((s) => s.setIdentity);
  const connected = useWalletStore((s) => s.connected);
  const [busy, setBusy] = useState(false);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const appendLog = useCallback((e: ActivityLogEntry) => {
    setLogEntries((prev) => [...prev, e]);
  }, []);
  const log = useMemo(
    () => createActivityLogger(appendLog, { prefix: "[ZKlaim Onboard]" }),
    [appendLog],
  );

  async function handleOnboard() {
    setBusy(true);
    setLogEntries([]);
    log.clear();
    log.info("Onboarding started");
    try {
      log.info("Connecting Freighter wallet…");
      const address = await ensureWalletConnected();
      log.success("Wallet connected", { address });
      log.info("Generating NaCl box keypair for claim decryption…");
      const box = generateBoxKeypair();
      log.success("Box keypair generated", {
        public_key_preview: `${box.publicKey.slice(0, 12)}…`,
      });
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
      log.success("Identity saved to OPFS", {
        policy_id: identity.policy_id,
        deductible_limit_cents: identity.deductible_limit_cents,
      });

      if (env.isSupabaseEnabled()) {
        log.info("Registering patient profile in Supabase directory…");
        await registerPatientProfile({
          address,
          boxPublicKey: box.publicKey,
          signMessage: freighterSignMessage,
        });
        log.success("Supabase directory registration complete");
        toast.success(
          "Registered in ZKlaim directory. Doctors can find you by your Stellar address.",
        );
      } else {
        log.warn("Supabase disabled — share encryption key manually with doctor");
        toast.success("Identity generated — share your encryption key with your doctor.");
      }
    } catch (err) {
      log.error("Onboarding failed", err);
      toast.error(err instanceof Error ? err.message : "Onboarding failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SectionCard label="Get started" title="Set up your ZKlaim identity">
      <div className="identity-onboard-checklist">
        <div className={`identity-onboard-checklist__item ${connected ? "identity-onboard-checklist__item--done" : ""}`}>
          <span className="identity-onboard-checklist__bullet" aria-hidden />
          <div>
            <p className="font-[650] text-sm">Connect Freighter (testnet)</p>
            <p className="text-xs text-muted-foreground">
              {connected
                ? "Wallet connected — you're ready to continue."
                : "Click your address in the header to connect and fund USDC."}
            </p>
          </div>
        </div>
        <div className="identity-onboard-checklist__item">
          <span className="identity-onboard-checklist__bullet" aria-hidden />
          <div>
            <p className="font-[650] text-sm">Generate local encryption keys</p>
            <p className="text-xs text-muted-foreground">
              Policy secrets stay in your browser (OPFS) — never on our servers.
            </p>
          </div>
        </div>
        {env.isSupabaseEnabled() ? (
          <div className="identity-onboard-checklist__item">
            <span className="identity-onboard-checklist__bullet" aria-hidden />
            <div>
              <p className="font-[650] text-sm">Register in the ZKlaim directory</p>
              <p className="text-xs text-muted-foreground">
                Doctors only need your Stellar address to send claims.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={handleOnboard}
        className="btn-primary mt-6 w-full py-3"
      >
        {busy ? "Setting up…" : "Connect & generate identity"}
      </button>
      <ActivityLogPanel
        entries={logEntries}
        title="Onboarding activity log"
        className="mt-4"
      />
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
