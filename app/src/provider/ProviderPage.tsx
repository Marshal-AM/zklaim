import { useEffect } from "react";
import { ensureWalletConnected } from "../components/WalletButton";
import { useWalletStore } from "../store/wallet";
import { loadProviderHistory } from "../lib/persistence";
import { useProviderStore } from "../store/providerStore";
import { NewClaimForm } from "./NewClaimForm";
import { ProviderHistory } from "./ProviderHistory";
import {
  ProviderRegistration,
  useProviderEnrollment,
} from "../components/ProviderRegistration";

export function ProviderPage() {
  const address = useWalletStore((s) => s.address);
  const connected = useWalletStore((s) => s.connected);
  const { enrolled, loading, refresh } = useProviderEnrollment(address);

  useEffect(() => {
    void loadProviderHistory().then((history) => {
      useProviderStore.setState({ history });
    });
  }, []);

  useEffect(() => {
    if (!connected) {
      void ensureWalletConnected().catch(() => {
        // user may decline
      });
    }
  }, [connected]);

  return (
    <section className="max-w-lg mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Provider Portal</h2>
        <p className="text-slate-400 text-sm mt-1">
          Licensed physicians create encrypted claim tokens for patients.
        </p>
      </div>

      {connected && !loading && !enrolled && (
        <ProviderRegistration onRegistered={refresh} />
      )}

      {connected && enrolled && (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
          <h3 className="font-medium mb-4">New claim</h3>
          <NewClaimForm />
        </div>
      )}

      {connected && loading && (
        <p className="text-sm text-slate-500">Checking provider enrollment…</p>
      )}

      {!connected && (
        <p className="text-sm text-slate-500">
          Connect Freighter to register as a provider or create a claim.
        </p>
      )}

      <div>
        <h3 className="font-medium mb-2">Claim history</h3>
        <ProviderHistory />
      </div>
    </section>
  );
}
