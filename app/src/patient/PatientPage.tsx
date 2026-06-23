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
import { PageHeader } from "../components/ui/PageHeader";
import { PageColumn, PageContent, PageGrid } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";
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
    return (
      <PageContent>
        <div className="animate-shimmer h-8 w-48 rounded-xl" />
        <div className="animate-shimmer mt-4 h-64 rounded-xl" />
      </PageContent>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Patient Portal"
        subtitle="Submit claims privately. Your diagnosis never leaves this device."
      />

      {!identity ? (
        <PageGrid>
          <PageColumn>
            <OnboardingPanel />
          </PageColumn>
          <PageColumn>
            <SectionCard label="How it works" title="Private claims flow">
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="badge-primary shrink-0">1</span>
                  Connect Freighter and generate your local encryption keys.
                </li>
                <li className="flex gap-3">
                  <span className="badge-primary shrink-0">2</span>
                  Share your Stellar address with your doctor.
                </li>
                <li className="flex gap-3">
                  <span className="badge-primary shrink-0">3</span>
                  Receive encrypted claims in your inbox and submit with ZK proofs.
                </li>
              </ol>
            </SectionCard>
          </PageColumn>
        </PageGrid>
      ) : (
        <PageGrid>
          <PageColumn>
            <IdentityCard />
            <ClaimInbox
              patientAddress={patientAddress}
              selectedClaimId={selectedClaimId}
              onSelectClaim={setSelectedClaimId}
            />
          </PageColumn>

          <PageColumn sticky>
            <DeductibleBar
              metCents={identity.accumulator_met_cents}
              limitCents={identity.deductible_limit_cents}
            />
            {selectedClaim ? (
              <SubmitClaimFlow
                claim={selectedClaim}
                onComplete={() => setSelectedClaimId(null)}
              />
            ) : submittable.length > 1 ? (
              <SectionCard label="Submit" title="Select a claim">
                <p className="text-sm text-muted-foreground">
                  Choose a claim from your inbox on the left, then generate proofs
                  and submit for USDC settlement.
                </p>
              </SectionCard>
            ) : submittable.length === 0 ? (
              <SectionCard label="Submit" title="No pending claims">
                <p className="text-sm text-muted-foreground">
                  When your doctor sends a claim, it will appear in your inbox.
                  You can submit it here for private settlement.
                </p>
              </SectionCard>
            ) : null}
            <SectionCard title="Claim history" label="Settled claims">
              <ClaimHistory />
            </SectionCard>
          </PageColumn>
        </PageGrid>
      )}
    </PageContent>
  );
}
