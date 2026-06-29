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
import { toast } from "../lib/toast";
import type { ClaimHistoryEntry } from "../types/patient";

function HistoryPassportAction({ entry }: { entry: ClaimHistoryEntry }) {
  const identity = usePatientStore((s) => s.identity);
  const inbox = usePatientStore((s) => s.inbox);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!isPassportConfigured() || !identity || !entry.txHash) {
    return null;
  }

  async function handleAdd() {
    if (!identity || !entry.txHash) return;
    setBusy(true);
    try {
      const store = await loadPassportStore();
      if (store && findLeafByNullifier(store, entry.nullifier)) {
        setDone(true);
        toast.success("Already in your Health Passport");
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
      toast.success("Claim added to your Health Passport");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add to passport");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <p className="text-safe-mono text-xs text-muted-foreground">
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
        {done ? (
          <p className="mt-2 text-xs text-success">
            In passport —{" "}
            <Link to="/patient/passport" className="underline">
              view
            </Link>
          </p>
        ) : null}
      </div>
      {!done ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleAdd()}
          className="btn-outline-primary shrink-0 self-start sm:self-center"
        >
          {busy ? "Adding…" : "Add to Passport"}
        </button>
      ) : null}
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
          <HistoryPassportAction entry={entry} />
        </li>
      ))}
    </ul>
  );
}
