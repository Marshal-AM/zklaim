import type { ActivityLogEntry } from "../lib/activityLog";
import { summarizeActivityLog } from "../lib/summarizeActivityLog";
import { formatUsdc } from "../lib/balances";
import { ModalPortal } from "./ModalPortal";

interface SubmitClaimSummaryModalProps {
  open: boolean;
  outcome: "success" | "error";
  entries: ActivityLogEntry[];
  usdcReceived?: number;
  onConfirm: () => void;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SubmitClaimSummaryModal({
  open,
  outcome,
  entries,
  usdcReceived,
  onConfirm,
}: SubmitClaimSummaryModalProps) {
  if (!open) return null;

  const summary = summarizeActivityLog(entries);
  const isSuccess = outcome === "success";

  return (
    <ModalPortal>
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-summary-title"
      >
      <div className="modal-panel modal-panel--wide">
        <header className="modal-panel__header">
          <p className="section-label mb-2">Claim submission complete</p>
          <h2
            id="submit-summary-title"
            className={`text-lg font-[650] tracking-tight ${
              isSuccess ? "text-success" : "text-destructive"
            }`}
          >
            {isSuccess ? "Claim settled successfully" : "Claim submission failed"}
          </h2>
          <p className="page-subtitle mt-1 max-w-prose">{summary.headline}</p>
        </header>

        <div className="modal-panel__body space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="card-shell p-3 text-center">
              <p className="section-label">Events</p>
              <p className="mt-1 text-2xl font-[650] tabular-nums">{summary.total}</p>
            </div>
            <div className="card-shell p-3 text-center">
              <p className="section-label">Duration</p>
              <p className="mt-1 text-2xl font-[650] tabular-nums">
                {formatDuration(summary.durationMs)}
              </p>
            </div>
            <div className="card-shell p-3 text-center">
              <p className="section-label">Success</p>
              <p className="mt-1 text-2xl font-[650] tabular-nums text-success">
                {summary.byLevel.success}
              </p>
            </div>
            <div className="card-shell p-3 text-center">
              <p className="section-label">Errors</p>
              <p className="mt-1 text-2xl font-[650] tabular-nums text-destructive">
                {summary.byLevel.error}
              </p>
            </div>
          </div>

          {isSuccess && usdcReceived !== undefined ? (
            <div className="success-card p-4 text-center">
              <p className="section-label">USDC received</p>
              <p className="mt-1 text-3xl font-[650] tabular-nums">
                +{formatUsdc(usdcReceived)}
              </p>
            </div>
          ) : null}

          {summary.txHashes.length > 0 ? (
            <div className="card-shell space-y-2 p-3">
              <p className="section-label">On-chain transactions</p>
              {summary.txHashes.map((hash) => (
                <a
                  key={hash}
                  href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-safe-mono text-xs text-primary underline"
                >
                  {hash}
                </a>
              ))}
            </div>
          ) : null}

          <div className="card-shell overflow-hidden">
            <div className="border-b border-border/60 px-3 py-2">
              <h3 className="section-label">Activity summary</h3>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto p-3 font-mono text-[11px] leading-[1.45]">
              {entries.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <span
                    className={`w-14 shrink-0 uppercase ${
                      entry.level === "error"
                        ? "text-destructive"
                        : entry.level === "success"
                          ? "text-success"
                          : entry.level === "warn"
                            ? "text-primary"
                            : "text-foreground/75"
                    }`}
                  >
                    {entry.level}
                  </span>
                  <span className="min-w-0 break-words text-foreground/90">
                    {entry.step}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="modal-panel__footer">
          <button
            type="button"
            onClick={onConfirm}
            className="btn-primary w-full py-3"
          >
            {isSuccess ? "Continue to settlement" : "Close and review logs"}
          </button>
        </footer>
      </div>
    </div>
    </ModalPortal>
  );
}
