import { useEffect, useMemo, useState } from "react";
import { usePatientStore } from "../store/patientStore";
import { loadPatientPersistence, savePatientIdentity } from "../lib/persistence";
import { tryNormalizeStellarAddress } from "../lib/stellarAddress";
import { OnboardingPanel } from "./OnboardingPanel";
import { IdentityCard } from "./IdentityCard";
import { ClaimInbox } from "./ClaimInbox";
import { SubmitClaimFlow } from "./SubmitClaimFlow";
import { ClaimHistory } from "./ClaimHistory";
import { DeductibleBar } from "../components/DeductibleBar";
import { useWalletStore } from "../store/wallet";

export function PatientPage() {
  const identity = usePatientStore((s) => s.identity);
  const inbox = usePatientStore((s) => s.inbox);
  const walletAddress = useWalletStore((s) => s.address);
  const setIdentity = usePatientStore((s) => s.setIdentity);
  const [loaded, setLoaded] = useState(false);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);

  const patientAddress = useMemo(
    () =>
      tryNormalizeStellarAddress(walletAddress) ??
      tryNormalizeStellarAddress(identity?.stellar_address) ??
      null,
    [walletAddress, identity?.stellar_address],
  );

  useEffect(() => {
    if (!identity || !walletAddress) return;
    const normalizedWallet = tryNormalizeStellarAddress(walletAddress);
    if (!normalizedWallet) return;
    if (identity.stellar_address === normalizedWallet) return;
    const updated = { ...identity, stellar_address: normalizedWallet };
    setIdentity(updated);
    void savePatientIdentity(updated);
  }, [identity, walletAddress, setIdentity]);

  useEffect(() => {
    void loadPatientPersistence().then((data) => {
      if (data.identity) setIdentity(data.identity);
      usePatientStore.setState({
        inbox: data.inbox,
        history: data.history,
      });
      setLoaded(true);
    });
  }, [setIdentity]);

  const submittable = inbox.filter(
    (c) => c.status === "pending" || c.status === "failed",
  );

  useEffect(() => {
    if (submittable.length === 0) {
      setSelectedClaimId(null);
      return;
    }
    if (submittable.length === 1) {
      setSelectedClaimId(submittable[0].id);
      return;
    }
    if (
      selectedClaimId &&
      !submittable.some((c) => c.id === selectedClaimId)
    ) {
      setSelectedClaimId(null);
    }
  }, [submittable, selectedClaimId]);

  const selectedClaim = submittable.find((c) => c.id === selectedClaimId);

  if (!loaded) {
    return <p className="text-slate-500">Loading…</p>;
  }

  return (
    <section className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Patient Portal</h2>
        <p className="text-slate-400 text-sm mt-1">
          Submit claims privately. Your diagnosis never leaves this device.
        </p>
      </div>

      {!identity ? (
        <OnboardingPanel />
      ) : (
        <>
          <IdentityCard />
          <DeductibleBar
            metCents={identity.accumulator_met_cents}
            limitCents={identity.deductible_limit_cents}
          />
          <ClaimInbox
            patientAddress={patientAddress}
            selectedClaimId={selectedClaimId}
            onSelectClaim={setSelectedClaimId}
          />
          {selectedClaim ? (
            <SubmitClaimFlow
              claim={selectedClaim}
              onComplete={() => setSelectedClaimId(null)}
            />
          ) : submittable.length > 1 ? (
            <p className="text-sm text-center text-slate-500 py-2">
              Select a claim in the inbox above, then submit.
            </p>
          ) : null}
          <div>
            <h3 className="font-medium mb-2">Claim history</h3>
            <ClaimHistory />
          </div>
        </>
      )}
    </section>
  );
}
