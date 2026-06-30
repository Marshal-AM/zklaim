import { connectFreighter, getFreighterAddress } from "./freighter";
import { env } from "../config/env";
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

/**
 * Admin panel / insurer ops must use the deployer wallet from .env
 * (VITE_DEPLOYER_PUBLIC_KEY or VITE_INSURER_FUND_ADDRESS).
 */
export async function ensureAdminWalletConnected(): Promise<string> {
  const required = env.adminAddress();
  const connected = await ensureWalletConnected();
  if (connected !== required) {
    throw new Error(
      `Admin actions require Freighter account ${required} (from .env). ` +
        `Currently connected: ${connected}. Switch to the deployer account in Freighter, or run ` +
        "`npx tsx scripts/register_passport_verifier.ts` with DEPLOYER_SECRET_KEY in .env.",
    );
  }
  return required;
}
