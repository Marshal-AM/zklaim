import { useNavigate } from "react-router-dom";
import { useWalletStore } from "../store/wallet";
import {
  ProviderRegistration,
  useProviderEnrollment,
} from "../components/ProviderRegistration";
import { SectionCard } from "../components/ui/SectionCard";
import type { DemoLicenseId } from "../lib/providerProfile";

export function ProviderRegisterPage() {
  const navigate = useNavigate();
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const { enrolled, physician, loading, refresh } = useProviderEnrollment(address);

  if (!connected) {
    return (
      <SectionCard label="Wallet" title="Connect to continue">
        <p className="text-sm text-muted-foreground">
          Connect Freighter using the button in the header to choose a provider
          credential.
        </p>
      </SectionCard>
    );
  }

  if (loading) {
    return (
      <div className="card-padded">
        <div className="animate-shimmer h-48 rounded-xl" />
        <p className="mt-3 text-center text-sm text-muted-foreground">
          Loading provider profile…
        </p>
      </div>
    );
  }

  const defaultLicense = (physician?.license_id ?? "MD-001") as DemoLicenseId;

  return (
    <div className="space-y-4">
      <ProviderRegistration
        defaultLicenseId={defaultLicense}
        mode={enrolled ? "change" : "register"}
        onRegistered={() => {
          refresh();
          navigate("/provider/create");
        }}
      />
    </div>
  );
}
