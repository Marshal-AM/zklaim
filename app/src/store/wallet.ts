import { create } from "zustand";
import { getTokenBalances } from "../lib/balances";

interface WalletState {
  address: string | null;
  connected: boolean;
  usdcBalance: string | null;
  setWallet: (address: string | null) => void;
  refreshBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  connected: false,
  usdcBalance: null,
  setWallet: (address) =>
    set({
      address,
      connected: address !== null,
      usdcBalance: address ? get().usdcBalance : null,
    }),
  refreshBalance: async () => {
    const { address } = get();
    if (!address) {
      set({ usdcBalance: null });
      return;
    }
    const balances = await getTokenBalances(address);
    set({ usdcBalance: balances.usdc });
  },
}));
