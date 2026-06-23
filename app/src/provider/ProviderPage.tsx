import { useEffect } from "react";
import { useWalletStore } from "../store/wallet";
import { loadProviderHistory } from "../lib/persistence";
import { useProviderStore } from "../store/providerStore";
import { NewClaimForm } from "./NewClaimForm";
import { ProviderHistory } from "./ProviderHistory";
import {
  ProviderRegistration,
  useProviderEnrollment,
} from "../components/ProviderRegistration";
import { PageHeader } from "../components/ui/PageHeader";
import { PageColumn, PageContent, PageGrid } from "../components/ui/PageGrid";
import { SectionCard } from "../components/ui/SectionCard";

export function ProviderPage() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const { enrolled, loading, refresh } = useProviderEnrollment(address);

  useEffect(() => {
    void loadProviderHistory().then((history) => {
      useProviderStore.setState({ history });
    });
  }, []);

  function renderPrimaryColumn() {
    if (!connected) {
      return (
        <SectionCard label="Wallet" title="Connect to continue">
          <p className="text-sm text-muted-foreground">
            Connect Freighter to register as a provider or create encrypted claims
            for patients.
          </p>
        </SectionCard>
      );
    }

    if (loading) {
      return (
        <div className="card-padded">
          <div className="animate-shimmer h-48 rounded-xl" />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Checking provider enrollment…
          </p>
        </div>
      );
    }

    if (!enrolled) {
      return <ProviderRegistration onRegistered={refresh} />;
    }

    return (
      <SectionCard label="New claim" title="Create encrypted claim">
        <NewClaimForm />
      </SectionCard>
    );
  }

  return (
    <PageContent>
      <PageHeader
        title="Provider Portal"
        subtitle="Licensed physicians create encrypted claim tokens for patients."
      />

      <PageGrid>
        <PageColumn>{renderPrimaryColumn()}</PageColumn>

        <PageColumn sticky>
          <SectionCard title="Claim history" label="Sent claims">
            <ProviderHistory />
          </SectionCard>
        </PageColumn>
      </PageGrid>
    </PageContent>
  );
}
