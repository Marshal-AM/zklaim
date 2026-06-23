import { useEffect, useState } from "react";
import { connectFreighter, getFreighterAddress } from "../lib/freighter";
import { useWalletStore } from "../store/wallet";
import { WalletModal } from "./WalletModal";

export function WalletButton() {
  const { address, connected, usdcBalance, setWallet, refreshBalance } =
    useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const existing = await getFreighterAddress();
      if (existing) {
        setWallet(existing);
        await refreshBalance();
      }
    })();
  }, [setWallet, refreshBalance]);

  async function handleDisconnect() {
    setWallet(null);
  }

  const parsedUsdc = Number.parseFloat(usdcBalance ?? "0");
  const displayBalance = Number.isFinite(parsedUsdc)
    ? parsedUsdc.toFixed(2)
    : null;

  return (
    <>
      <div className="flex items-center gap-3">
        {connected && address ? (
          <>
            {displayBalance !== null ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="text-xs font-semibold text-emerald-400 hover:text-emerald-300"
              >
                {displayBalance} USDC
              </button>
            ) : null}
            <span className="text-xs text-slate-400 font-mono truncate max-w-[140px]">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500"
            >
              Wallet
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              className="text-xs px-3 py-1.5 rounded border border-slate-700 hover:border-slate-500"
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            Connect Freighter
          </button>
        )}
      </div>
      <WalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}

export async function ensureWalletConnected(): Promise<string> {
  const existing = await getFreighterAddress();
  if (existing) {
    useWalletStore.getState().setWallet(existing);
    void useWalletStore.getState().refreshBalance();
    return existing;
  }
  const addr = await connectFreighter();
  useWalletStore.getState().setWallet(addr);
  void useWalletStore.getState().refreshBalance();
  return addr;
}
