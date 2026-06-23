/** Set when the user explicitly signs out — blocks silent Freighter re-hydration. */
export const WALLET_DISCONNECTED_KEY = "zklaim_wallet_disconnected";

export function isWalletSessionSuppressed(): boolean {
  try {
    return sessionStorage.getItem(WALLET_DISCONNECTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWalletSessionDisconnected(): void {
  try {
    sessionStorage.setItem(WALLET_DISCONNECTED_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

export function clearWalletSessionSuppressed(): void {
  try {
    sessionStorage.removeItem(WALLET_DISCONNECTED_KEY);
  } catch {
    // ignore
  }
}
