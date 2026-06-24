import { useWalletStore } from "../store/wallet";
import { NewClaimForm } from "./NewClaimForm";
import {
  ProviderRegistration,
  useProviderEnrollment,
} from "../components/ProviderRegistration";
import { SectionCard } from "../components/ui/SectionCard";

export function ProviderCreatePage() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const { enrolled, loading, refresh } = useProviderEnrollment(address);

  if (!connected) {
    return (
      <SectionCard label="Wallet" title="Connect to continue">
        <p className="text-sm text-muted-foreground">
          Connect Freighter using the button in the header to register as a
          provider or create encrypted claims.
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
