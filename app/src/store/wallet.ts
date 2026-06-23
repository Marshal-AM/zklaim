import { create } from "zustand";
import { getFreighterAddress } from "../lib/freighter";
import { getTokenBalances } from "../lib/balances";
import {
  clearWalletSessionSuppressed,
  isWalletSessionSuppressed,
  markWalletSessionDisconnected,
} from "../lib/walletPersistence";

interface WalletState {
  address: string | null;
  connected: boolean;
  usdcBalance: string | null;
  hydrated: boolean;
  setWallet: (address: string | null) => void;
  disconnect: () => void;
  hydrateFromFreighter: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  address: null,
  connected: false,
  usdcBalance: null,
  hydrated: false,
  setWallet: (address) => {
    if (address) {
      clearWalletSessionSuppressed();
    }
    set({
      address,
      connected: address !== null,
      usdcBalance: address ? get().usdcBalance : null,
    });
  },
  disconnect: () => {
    markWalletSessionDisconnected();
    set({
      address: null,
      connected: false,
      usdcBalance: null,
    });
  },
  hydrateFromFreighter: async () => {
    if (get().hydrated) return;
    set({ hydrated: true });

    if (isWalletSessionSuppressed()) return;

    const existing = await getFreighterAddress();
    if (!existing) return;

    set({
      address: existing,
      connected: true,
    });
    await get().refreshBalance();
  },
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
