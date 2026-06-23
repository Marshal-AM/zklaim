import { useCallback, useEffect, useState } from "react";
import { connectFreighter } from "../lib/freighter";
import {
  setupFreighterWallet,
  type SetupStepStatus,
} from "../lib/walletSetup";
import { useWalletStore } from "../store/wallet";

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
  const { address, connected, usdcBalance, setWallet, refreshBalance } =
    useWalletStore();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setError(null);
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
      setError(message);
      const activeIndex = steps.findIndex((step) => step.status === "active");
      if (activeIndex >= 0) {
        setStep(activeIndex, "error", message);
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close wallet modal"
        className="absolute inset-0 bg-black/60"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 shadow-xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Stellar Wallet</h2>
          <p className="text-sm text-slate-400 mt-1">
            Connect Freighter on testnet, fund with Friendbot, and enable the
            Circle USDC trustline.
          </p>
        </div>

        {connected && address ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-400">Public key</p>
            <div className="flex items-start gap-2">
              <code className="flex-1 font-mono text-xs bg-slate-950 border border-slate-800 p-3 rounded break-all">
                {address}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="shrink-0 text-xs px-2 py-2 rounded border border-slate-700 hover:border-slate-500"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="text-center space-y-1">
          <p className="text-xs text-slate-400">Stellar testnet USDC balance</p>
          <p className="text-3xl font-bold">
            {displayBalance}{" "}
            <span className="text-sm font-medium text-slate-400">USDC</span>
          </p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
          <h3 className="text-sm font-medium">Setup progress</h3>
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li key={step.label} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-800 text-xs">
                  {step.status === "done"
                    ? "✓"
                    : step.status === "error"
                      ? "!"
                      : step.status === "active"
                        ? "…"
                        : index + 1}
                </span>
                <div>
                  <div className="font-medium">{step.label}</div>
                  {step.detail ? (
                    <div
                      className={
                        step.status === "error"
                          ? "text-xs text-red-400"
                          : "text-xs text-slate-400"
                      }
                    >
                      {step.detail}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleConnectAndSetup()}
          className="w-full px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
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
            onClick={() => {
              setError(null);
              void (async () => {
                setBusy(true);
                try {
                  const publicKey = await connectFreighter();
                  setWallet(publicKey);
                  setStep(0, "done", `${publicKey.slice(0, 8)}…`);
                  await fetchBalances();
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Connect failed",
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="w-full text-sm px-4 py-2 rounded border border-slate-700 hover:border-slate-500"
          >
            Connect only (skip Friendbot / trustline)
          </button>
        ) : null}
        </div>

        {error ? <p className="text-sm text-red-400">{error}</p> : null}

        <div className="space-y-2 rounded-lg border border-sky-900/50 bg-sky-950/30 p-4 text-sm text-sky-100">
          <p className="font-medium">Next: get testnet USDC</p>
          <p className="text-sky-200/80 text-xs">
            Visit the Circle faucet and airdrop USDC to your Stellar public key.
            Choose <strong>Stellar</strong> as the network.
          </p>
          <button
            type="button"
            onClick={openCircleFaucet}
            className="w-full px-4 py-2 rounded bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium"
          >
            Open Circle faucet
          </button>
        </div>

        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="w-full text-sm px-4 py-2 rounded border border-slate-700 hover:border-slate-500"
        >
          Close
        </button>
      </div>
    </div>
  );
}
