import { useState } from "react";
import { Link } from "react-router-dom";
import { usePatientStore } from "../store/patientStore";
import { decryptClaimToken } from "../lib/claimToken";
import { appendSettlementToPassport } from "../lib/passportAppend";
import {
  findLeafByNullifier,
  loadPassportStore,
} from "../lib/passportStore";
import { isPassportConfigured } from "../lib/passportContract";
import { ensureWalletConnected } from "../lib/walletSession";
import { ErrorBanner } from "../components/ErrorBanner";
import type { ClaimHistoryEntry } from "../types/patient";

function HistoryPassportAction({ entry }: { entry: ClaimHistoryEntry }) {
  const identity = usePatientStore((s) => s.identity);
  const inbox = usePatientStore((s) => s.inbox);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPassportConfigured() || !identity || !entry.txHash) {
    return null;
  }

  async function handleAdd() {
    if (!identity || !entry.txHash) return;
    setBusy(true);
    setError(null);
    try {
      const store = await loadPassportStore();
      if (store && findLeafByNullifier(store, entry.nullifier)) {
        setDone(true);
        return;
      }

      const claim = entry.claimId
        ? inbox.find((c) => c.id === entry.claimId)
        : undefined;
      if (!claim) {
        throw new Error(
          "Claim payload not found locally. Use Add to Passport on the settlement receipt right after submit.",
        );
      }

      const payload = await decryptClaimToken(
        claim.token,
        identity.box_secret_key,
      );
      const patientAddress = await ensureWalletConnected();

      await appendSettlementToPassport({
        patientAddress,
        nullifierHex: entry.nullifier,
        txHash: entry.txHash,
        payload,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add to passport");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p className="mt-2 text-xs text-success">
        In passport —{" "}
        <Link to="/patient/passport" className="underline">
          view
        </Link>
      </p>
    );
  }

  return (
    <div className="mt-2">
      {error ? <ErrorBanner message={error} /> : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleAdd()}
        className="btn-outline-primary text-xs"
      >
        {busy ? "Adding…" : "Add to Passport"}
      </button>
    </div>
  );
}

export function ClaimHistory() {
  const history = usePatientStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No settled claims yet. History shows nullifiers only — no medical data.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.nullifier} className="surface-row px-4 py-3 text-sm">
          <p className="truncate font-mono text-xs text-muted-foreground">
            {entry.nullifier}
          </p>
          <p className="mt-1 text-xs text-subtle">
            {new Date(entry.submittedAt).toLocaleString()}
            {entry.txHash ? (
              <>
                {" · "}
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${entry.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  explorer
                </a>
              </>
            ) : null}
          </p>
          <HistoryPassportAction entry={entry} />
        </li>
      ))}
    </ul>
  );
}
