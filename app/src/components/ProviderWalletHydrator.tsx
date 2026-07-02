import { useEffect } from "react";
import { hydrateProviderForWallet } from "../lib/providerHydration";
import { useWalletStore } from "../store/wallet";

/** Reload provider history whenever the connected Freighter wallet changes. */
export function ProviderWalletHydrator() {
  const address = useWalletStore((s) => s.address);
  const hydrated = useWalletStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    void hydrateProviderForWallet(address);
  }, [address, hydrated]);

  return null;
}
