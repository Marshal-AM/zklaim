import { connectFreighter, getFreighterAddress } from "./freighter";
import { isWalletSessionSuppressed } from "./walletPersistence";
import { useWalletStore } from "../store/wallet";

/**
 * Require a wallet for an explicit user action (submit, onboard, etc.).
 * Reuses the in-app session, silently syncs from Freighter if already allowed,
 * or prompts Freighter only when needed.
 */
export async function ensureWalletConnected(): Promise<string> {
  const { address, connected, setWallet, refreshBalance } =
    useWalletStore.getState();
  if (connected && address) {
    return address;
  }

  if (!isWalletSessionSuppressed()) {
    const existing = await getFreighterAddress();
    if (existing) {
      setWallet(existing);
      void refreshBalance();
      return existing;
    }
  }

  const nextAddress = await connectFreighter();
  setWallet(nextAddress);
  void refreshBalance();
  return nextAddress;
}
