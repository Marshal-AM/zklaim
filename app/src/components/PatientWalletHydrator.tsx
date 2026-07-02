import { useEffect } from "react";
import { hydratePatientForWallet } from "../lib/patientHydration";
import { useWalletStore } from "../store/wallet";

/** Reload patient OPFS + store whenever the connected Freighter wallet changes. */
export function PatientWalletHydrator() {
  const address = useWalletStore((s) => s.address);
  const hydrated = useWalletStore((s) => s.hydrated);

  useEffect(() => {
    if (!hydrated) return;
    void hydratePatientForWallet(address);
  }, [address, hydrated]);

  return null;
}
