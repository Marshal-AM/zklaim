import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { decodeTokenFromUrl, type EncryptedClaimToken } from "../lib/claimToken";
import {
  fetchPendingDeliveries,
  markDeliveryImported,
  rowToEncryptedToken,
} from "../lib/claimDelivery";
import {
  formatVisitDate,
  importClaimToInbox,
  shortClaimId,
  summarizeInboxClaim,
} from "../lib/claimInbox";
import { env } from "../config/env";
import { getSupabase } from "../lib/supabase";
import { savePatientInbox } from "../lib/persistence";
import { usePatientStore } from "../store/patientStore";
import { ErrorBanner } from "../components/ErrorBanner";

interface ClaimInboxProps {
  patientAddress: string | null;
  selectedClaimId: string | null;
  onSelectClaim: (claimId: string) => void;
}

export function ClaimInbox({
  patientAddress,
  selectedClaimId,
  onSelectClaim,
}: ClaimInboxProps) {
  const [params, setParams] = useSearchParams();
  const identity = usePatientStore((s) => s.identity);
  const inbox = usePatientStore((s) => s.inbox);
  const addInboxClaim = usePatientStore((s) => s.addInboxClaim);
  const [error, setError] = useState<string | null>(null);

  const importToken = useCallback(
    async (
      token: EncryptedClaimToken,
      deliveryId?: string,
    ): Promise<boolean> => {
      if (!identity) return false;

      const currentInbox = usePatientStore.getState().inbox;
      const result = importClaimToInbox(
        token,
        identity,
        currentInbox,
        deliveryId,
      );
      if (!result.ok) {
        if (result.reason === "duplicate" && deliveryId) {
          await markDeliveryImported(deliveryId);
        }
        return false;
      }

      const next = [...currentInbox, result.entry];
      addInboxClaim(result.entry);
      await savePatientInbox(next);
      onSelectClaim(result.entry.id);

      if (deliveryId) {
        await markDeliveryImported(deliveryId);
      }

      return true;
    },
    [identity, addInboxClaim, onSelectClaim],
  );

  const syncSupabaseDeliveries = useCallback(async () => {
    if (!identity || !patientAddress || !env.isSupabaseEnabled()) return;

    try {
      const rows = await fetchPendingDeliveries(patientAddress);
      for (const row of rows) {
        const token = rowToEncryptedToken(row);
        await importToken(token, row.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to sync claim inbox",
      );
    }
  }, [identity, patientAddress, importToken]);

  useEffect(() => {
    const claimParam = params.get("claim");
    if (!claimParam || !identity) return;

    void (async () => {
      try {
        const token = decodeTokenFromUrl(claimParam);
        const imported = await importToken(token);
        if (imported) {
          params.delete("claim");
          setParams(params, { replace: true });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import claim");
      }
    })();
  }, [params, identity, importToken, setParams]);

  useEffect(() => {
    void syncSupabaseDeliveries();
  }, [syncSupabaseDeliveries]);

  useEffect(() => {
    if (!patientAddress || !identity || !env.isSupabaseEnabled()) return;

    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel(`claim_deliveries:${patientAddress}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "claim_deliveries",
          filter: `patient_address=eq.${patientAddress}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            encrypted_token: EncryptedClaimToken;
            status: string;
          };
          if (row.status !== "pending") return;
          void importToken(row.encrypted_token, row.id);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [patientAddress, identity, importToken]);

  const inboxClaims = inbox.filter(
    (c) => c.status === "pending" || c.status === "failed",
  );

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium">Claim inbox</h3>
        {inboxClaims.length > 1 && (
          <span className="text-xs text-slate-500">Tap a claim to select it</span>
        )}
      </div>
      {inboxClaims.length === 0 ? (
        <p className="text-sm text-slate-500">
          {env.isSupabaseEnabled()
            ? "No pending claims. Claims appear automatically when your doctor sends them, or via QR/deep link."
            : "No pending claims. Ask your doctor to send a claim token via QR or deep link."}
        </p>
      ) : (
        <ul className="space-y-2">
          {inboxClaims.map((claim) => {
            const selected = claim.id === selectedClaimId;
            const summary = identity
              ? summarizeInboxClaim(claim, identity.box_secret_key)
              : null;
            const failed = claim.status === "failed";

            return (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => onSelectClaim(claim.id)}
                  className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                    selected
                      ? failed
                        ? "border-amber-400 bg-amber-950/40 ring-2 ring-amber-500/50"
                        : "border-emerald-400 bg-emerald-950/40 ring-2 ring-emerald-500/50"
                      : failed
                        ? "border-amber-900/40 bg-amber-950/20 hover:border-amber-700/60"
                        : "border-emerald-900/40 bg-emerald-950/20 hover:border-emerald-700/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p
                      className={`font-medium ${
                        failed ? "text-amber-300" : "text-emerald-300"
                      }`}
                    >
                      {summary
                        ? `${summary.amount_label} · ${summary.icd_code} · ${summary.doctor_license_id}`
                        : "Encrypted claim"}
                    </p>
                    {selected && (
                      <span
                        className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded ${
                          failed
                            ? "bg-amber-900/60 text-amber-200"
                            : "bg-emerald-900/60 text-emerald-200"
                        }`}
                      >
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {summary
                      ? `Visit ${formatVisitDate(summary.visit_date)}`
                      : null}
                    {summary ? " · " : ""}
                    Received {new Date(claim.receivedAt).toLocaleString()}
                    {failed ? " · previous submit failed" : ""}
                  </p>
                  <p className="text-[10px] text-slate-600 font-mono mt-1">
                    {shortClaimId(claim.id)}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
