import { useState } from "react";
import { useWalletStore } from "../store/wallet";
import { WalletModal } from "./WalletModal";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" x2="9" y1="12" y2="12" />
    </svg>
  );
}

export function WalletButton() {
  const { address, connected, usdcBalance, disconnect } = useWalletStore();
  const [modalOpen, setModalOpen] = useState(false);

  const parsedUsdc = Number.parseFloat(usdcBalance ?? "0");
  const displayBalance = Number.isFinite(parsedUsdc)
    ? parsedUsdc.toFixed(2)
    : null;

  return (
    <>
      {!connected || !address ? (
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="btn-primary px-5 py-2 text-xs"
        >
          Connect Wallet
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <div className="nav-pill gap-1 px-1.5 py-1.5">
            {displayBalance !== null ? (
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="hidden items-center rounded-full px-3 py-1.5 font-mono text-[11px] font-[650] text-primary transition-spring hover:bg-muted/40 sm:flex"
              >
                {displayBalance} USDC
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              title="Open wallet"
              className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[12px] text-foreground transition-spring hover:bg-muted/40"
            >
              <span className="h-2 w-2 rounded-full bg-success" />
              {truncateAddress(address)}
            </button>
          </div>
          <button
            type="button"
            onClick={disconnect}
            title="Sign out"
            aria-label="Sign out"
            className="wallet-signout-btn flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-card text-muted-foreground transition-spring hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
          >
            <SignOutIcon className="h-4 w-4" />
          </button>
        </div>
      )}
      <WalletModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
