import { useEffect, type ReactNode } from "react";
import { loadPatientPersistence, savePatientIdentity } from "../../lib/persistence";
import { tryNormalizeStellarAddress } from "../../lib/stellarAddress";
import { usePatientStore } from "../../store/patientStore";
import { useWalletStore } from "../../store/wallet";
import { PageHeader } from "../ui/PageHeader";
import { PageContent } from "../ui/PageGrid";

const TAB_COPY = {
  identity: {
    title: "Your identity",
    subtitle:
      "Set up encryption keys and share your Stellar address with your doctor.",
  },
  inbox: {
    title: "Claim inbox",
    subtitle:
      "Encrypted claims from your provider appear here — via directory sync or deep link.",
  },
  submit: {
    title: "Submit claim",
    subtitle:
      "Generate zero-knowledge proofs locally and settle in USDC. Your diagnosis never leaves this device.",
  },
  history: {
    title: "Claim history",
    subtitle:
      "Settled claims — nullifiers and timestamps only. No medical data is stored.",
  },
} as const;

export type PatientTab = keyof typeof TAB_COPY;

interface PatientLayoutProps {
  tab: PatientTab;
  children: ReactNode;
}

export function PatientLayout({ tab, children }: PatientLayoutProps) {
  const walletAddress = useWalletStore((s) => s.address);
  const identity = usePatientStore((s) => s.identity);
  const setIdentity = usePatientStore((s) => s.setIdentity);

  useEffect(() => {
    void loadPatientPersistence().then((data) => {
      if (data.identity) setIdentity(data.identity);
      usePatientStore.setState({
        inbox: data.inbox,
        history: data.history,
      });
    });
  }, [setIdentity]);

  useEffect(() => {
    if (!identity || !walletAddress) return;
    const normalizedWallet = tryNormalizeStellarAddress(walletAddress);
    if (!normalizedWallet) return;
    if (identity.stellar_address === normalizedWallet) return;
    const updated = { ...identity, stellar_address: normalizedWallet };
    setIdentity(updated);
    void savePatientIdentity(updated);
  }, [identity, walletAddress, setIdentity]);

  const copy = TAB_COPY[tab];

  return (
    <PageContent>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      {children}
    </PageContent>
  );
}
