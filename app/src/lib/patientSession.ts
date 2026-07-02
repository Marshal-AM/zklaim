import { usePatientStore } from "../store/patientStore";
import { assertIdentityWallet } from "./patientWalletScope";

/** Active patient wallet from hydration (must match Freighter). */
export function activePatientWallet(): string | null {
  return usePatientStore.getState().activeWalletAddress;
}

export function requireActivePatientWallet(): string {
  const wallet = activePatientWallet();
  if (!wallet) {
    throw new Error("Connect your patient wallet to continue.");
  }
  return wallet;
}

export function requirePatientIdentityForWallet(): {
  wallet: string;
  identity: NonNullable<ReturnType<typeof usePatientStore.getState>["identity"]>;
} {
  const wallet = requireActivePatientWallet();
  const identity = usePatientStore.getState().identity;
  if (!identity) {
    throw new Error("Complete patient identity setup for this wallet first.");
  }
  assertIdentityWallet(identity, wallet);
  return { wallet, identity };
}
