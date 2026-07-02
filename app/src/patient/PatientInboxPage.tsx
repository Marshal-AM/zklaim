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
  const activeWalletAddress = usePatientStore((s) => s.activeWalletAddress);
  const walletAddress = useWalletStore((s) => s.address);

  const patientAddress = useMemo(
    () =>
      tryNormalizeStellarAddress(activeWalletAddress) ??
      tryNormalizeStellarAddress(walletAddress) ??
      null,
    [activeWalletAddress, walletAddress],
  );

  if (!walletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to receive and decrypt claims for this account.
        </p>
      </SectionCard>
    );
  }

  if (!identity) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Set up your identity for this wallet on the Identity tab before claims
          can be received.
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
