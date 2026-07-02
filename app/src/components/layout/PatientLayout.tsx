import type { ReactNode } from "react";
import { PageHeader } from "../ui/PageHeader";
import { PageContent } from "../ui/PageGrid";

const TAB_COPY = {
  identity: {
    title: "Your identity",
    subtitle:
      "Share your Stellar address with your doctor and track deductible progress — all from this device.",
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
  passport: {
    title: "Health Passport",
    subtitle:
      "Your private claim history — share selective credentials without revealing diagnosis.",
  },
} as const;

export type PatientTab = keyof typeof TAB_COPY;

interface PatientLayoutProps {
  tab: PatientTab;
  children: ReactNode;
}

export function PatientLayout({ tab, children }: PatientLayoutProps) {
  const copy = TAB_COPY[tab];

  return (
    <PageContent>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      {children}
    </PageContent>
  );
}
