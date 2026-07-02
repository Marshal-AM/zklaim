import { useCallback, useEffect, useState } from "react";
import { connectFreighter } from "../lib/freighter";
import {
  setupFreighterWallet,
  type SetupStepStatus,
} from "../lib/walletSetup";
import { useWalletStore } from "../store/wallet";
import { toast } from "../lib/toast";
import { ModalPortal } from "./ModalPortal";

const INITIAL_STEPS = [
  { label: "Connect Freighter (testnet)", status: "idle" as SetupStepStatus, detail: "" },
  { label: "Fund with Friendbot", status: "idle" as SetupStepStatus, detail: "" },
  { label: "Create USDC trustline", status: "idle" as SetupStepStatus, detail: "" },
];

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { address, connected, usdcBalance, setWallet, disconnect, refreshBalance } =
    useWalletStore();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [steps, setSteps] = useState(INITIAL_STEPS);

  const setStep = (
    index: number,
    status: SetupStepStatus,
    detail = "",
  ) => {
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === index ? { ...step, status, detail } : step,
      ),
    );
  };

  const resetSteps = () => setSteps(INITIAL_STEPS);

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    await refreshBalance();
  }, [address, refreshBalance]);

  useEffect(() => {
    if (address) {
      void fetchBalances();
    }
  }, [address, fetchBalances]);

  useEffect(() => {
    if (open && address) {
      void fetchBalances();
    }
  }, [open, address, fetchBalances]);

  async function handleConnectAndSetup() {
    setBusy(true);
    resetSteps();

    try {
      setStep(0, "active", "Requesting Freighter access...");
      const publicKey = await connectFreighter();
      setWallet(publicKey);
      setStep(0, "done", `${publicKey.slice(0, 8)}…`);

      await setupFreighterWallet(publicKey, (index, status, detail) => {
        setStep(index + 1, status, detail ?? "");
      });

      await fetchBalances();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Wallet setup failed";
      toast.error(message);
      const activeIndex = steps.findIndex((step) => step.status === "active");
      if (activeIndex >= 0) {
        setStep(activeIndex, "error", message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleConnectOnly() {
    setBusy(true);
    try {
      const publicKey = await connectFreighter();
      setWallet(publicKey);
      setStep(0, "done", `${publicKey.slice(0, 8)}…`);
      await fetchBalances();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openCircleFaucet() {
    window.open("https://faucet.circle.com/", "_blank", "noopener,noreferrer");
  }

  const parsedUsdc = Number.parseFloat(usdcBalance ?? "0");
  const displayBalance = Number.isFinite(parsedUsdc)
    ? parsedUsdc.toFixed(2)
    : "0.00";

  if (!open) return null;

  return (
    <ModalPortal>
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-modal-title"
    >
      <button
        type="button"
        aria-label="Close wallet modal"
        className="absolute inset-0"
        onClick={() => onOpenChange(false)}
      />
      <div className="modal-panel modal-panel--wide">
        <header className="modal-panel__header flex items-start justify-between gap-3">
          <div>
            <p className="section-label mb-2">Stellar wallet</p>
            <h2
              id="wallet-modal-title"
              className="text-lg font-[650] tracking-tight"
            >
              Freighter on testnet
            </h2>
            <p className="page-subtitle mt-1 max-w-prose">
              Connect Freighter, fund with Friendbot, and enable the Circle USDC
              trustline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-secondary shrink-0 px-3 py-2 text-xs"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="modal-panel__body">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Left: account & balance */}
            <div className="flex flex-col gap-4">
              <div className="card-shell flex flex-1 flex-col justify-center p-4 text-center">
                <p className="section-label">Testnet USDC balance</p>
                <p className="mt-2 text-3xl font-[650] tabular-nums tracking-tight sm:text-4xl">
                  {displayBalance}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">USDC</p>
              </div>

              {connected && address ? (
                <div className="space-y-2">
                  <p className="section-label">Public key</p>
                  <code className="surface-row block max-h-24 overflow-y-auto p-3 text-[11px] leading-relaxed text-safe-mono">
                    {address}
                  </code>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="btn-secondary text-xs"
                    >
                      {copied ? "Copied" : "Copy address"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        disconnect();
                        resetSteps();
                      }}
                      className="btn-outline-primary text-xs"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="info-card p-4 text-sm text-muted-foreground">
                  Connect Freighter to view your Stellar address and fund your
                  testnet wallet.
                </div>
              )}
            </div>

            {/* Right: setup & funding */}
            <div className="flex flex-col gap-4">
              <div className="card-shell space-y-3 p-4">
                <h3 className="text-sm font-[650]">Setup progress</h3>
                <ol className="space-y-2">
                  {steps.map((step, index) => (
                    <li
                      key={step.label}
                      className="flex items-start gap-2 text-sm"
                    >
                      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-[650]">
                        {step.status === "done"
                          ? "✓"
                          : step.status === "error"
                            ? "!"
                            : step.status === "active"
                              ? "…"
                              : index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="font-[650]">{step.label}</div>
                        {step.detail ? (
                          <div
                            className={
                              step.status === "error"
                                ? "text-xs text-destructive"
                                : "text-xs text-muted-foreground"
                            }
                          >
                            {step.detail}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleConnectAndSetup()}
                    className="btn-primary w-full"
                  >
                    {busy
                      ? "Connecting…"
                      : connected
                        ? "Re-run wallet setup"
                        : "Connect Freighter"}
                  </button>
                  {!connected && !busy ? (
                    <button
                      type="button"
                      onClick={() => void handleConnectOnly()}
                      className="btn-outline-primary w-full"
                    >
                      Connect only (skip Friendbot / trustline)
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="highlight-card space-y-2 p-4 text-sm">
                <p className="font-[650] text-primary">Get testnet USDC</p>
                <p className="text-xs text-muted-foreground">
                  Visit the Circle faucet and airdrop USDC to your Stellar public
                  key. Choose{" "}
                  <strong className="text-foreground">Stellar</strong> as the
                  network.
                </p>
                <button
                  type="button"
                  onClick={openCircleFaucet}
                  className="btn-primary w-full text-xs"
                >
                  Open Circle faucet
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer className="modal-panel__footer space-y-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="btn-secondary w-full"
          >
            Close
          </button>
        </footer>
      </div>
    </div>
    </ModalPortal>
  );
}
