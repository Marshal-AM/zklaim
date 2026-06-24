import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ClaimInbox } from "./ClaimInbox";
import { usePatientStore } from "../store/patientStore";
import { tryNormalizeStellarAddress } from "../lib/stellarAddress";
import { useWalletStore } from "../store/wallet";
import { SectionCard } from "../components/ui/SectionCard";

export function PatientInboxPage() {
  const navigate = useNavigate();
  const identity = usePatientStore((s) => s.identity);
  const walletAddress = useWalletStore((s) => s.address);

  const patientAddress = useMemo(
    () =>
      tryNormalizeStellarAddress(walletAddress) ??
      tryNormalizeStellarAddress(identity?.stellar_address) ??
      null,
    [walletAddress, identity?.stellar_address],
  );

  if (!identity) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Go to the Identity tab to connect Freighter and generate your encryption
          keys before claims can be received.
        </p>
      </SectionCard>
    );
  }

  return (
    <ClaimInbox
      patientAddress={patientAddress}
      onSelectClaim={(claimId) => navigate(`/patient/submit/${claimId}`)}
    />
  );
}
