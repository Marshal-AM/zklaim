import { useCallback, useState } from "react";
import { useWalletStore } from "../store/wallet";
import { WalletModal } from "./WalletModal";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletButton() {
  const { address, connected, usdcBalance, disconnect } = useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const parsedUsdc = Number.parseFloat(usdcBalance ?? "0");
  const displayBalance = Number.isFinite(parsedUsdc)
    ? parsedUsdc.toFixed(2)
    : null;

  const copyAddress = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, [address]);

  return (
    <>
      {!connected || !address ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs px-5 py-2"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="nav-pill gap-2 px-2 py-1.5">
          {displayBalance !== null ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="hidden sm:flex items-center rounded-full px-3 py-1.5 font-mono text-[11px] font-[650] text-primary transition-spring hover:bg-muted/40"
            >
              {displayBalance} USDC
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void copyAddress()}
            title={address}
            className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[12px] text-foreground transition-spring hover:bg-muted/40"
          >
            <span className="h-2 w-2 rounded-full bg-success" />
            {copied ? "Copied!" : truncateAddress(address)}
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-full px-3 py-1.5 text-[11px] font-[650] uppercase tracking-wider text-muted-foreground transition-spring hover:bg-muted/40 hover:text-foreground"
          >
            Wallet
          </button>
          <button
            type="button"
            onClick={disconnect}
            className="rounded-full px-3 py-1.5 text-[11px] font-[650] uppercase tracking-wider text-muted-foreground transition-spring hover:bg-muted/40 hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      )}
      <WalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
