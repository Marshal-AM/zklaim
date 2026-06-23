import { useEffect } from "react";
import { useWalletStore } from "../store/wallet";

/** Restores wallet state from Freighter on reload (no popup if already allowed). */
export function WalletHydrator() {
  useEffect(() => {
    void useWalletStore.getState().hydrateFromFreighter();
  }, []);

  return null;
}
