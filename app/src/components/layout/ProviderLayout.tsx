import { useEffect, type ReactNode } from "react";
import { loadProviderHistory } from "../../lib/persistence";
import { useProviderStore } from "../../store/providerStore";
import { PageHeader } from "../ui/PageHeader";
import { PageContent } from "../ui/PageGrid";

const TAB_COPY = {
  create: {
    title: "Create claim",
    subtitle:
      "Sign and encrypt a claim token for your patient — delivered via directory or QR.",
  },
  history: {
    title: "Claim history",
    subtitle:
      "Claims you have sent — hash and date only. No patient medical data.",
  },
} as const;

export type ProviderTab = keyof typeof TAB_COPY;

interface ProviderLayoutProps {
  tab: ProviderTab;
  children: ReactNode;
}

export function ProviderLayout({ tab, children }: ProviderLayoutProps) {
  useEffect(() => {
    void loadProviderHistory().then((history) => {
      useProviderStore.setState({ history });
    });
  }, []);

  const copy = TAB_COPY[tab];

  return (
    <PageContent>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      {children}
    </PageContent>
  );
}
