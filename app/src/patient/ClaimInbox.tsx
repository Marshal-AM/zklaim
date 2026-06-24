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
  onSelectClaim: (claimId: string) => void;
}

export function ClaimInbox({
  patientAddress,
  onSelectClaim,
}: ClaimInboxProps) {
  const [params, setParams] = useSearchParams();
  const identity = usePatientStore((s) => s.identity);
  const inbox = usePatientStore((s) => s.inbox);
  const addInboxClaim = usePatientStore((s) => s.addInboxClaim);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const importFailureMessage = (
    reason: "duplicate" | "invalid_signature" | "decrypt_failed",
  ): string | null => {
    switch (reason) {
      case "decrypt_failed":
        return (
          "Could not decrypt a claim from your inbox. Your local encryption keys " +
          "may not match the ZKlaim directory — reconnect the same Freighter wallet " +
          "you used at onboarding, or re-register your profile."
        );
      case "invalid_signature":
        return "A claim from your inbox has an invalid doctor signature. Ask your provider to resend.";
      default:
        return null;
    }
  };

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
        } else {
          const message = importFailureMessage(result.reason);
          if (message) setError(message);
        }
        return false;
      }

      setError(null);
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
    if (!identity || !env.isSupabaseEnabled()) return;

    if (!patientAddress) return;

    setSyncing(true);
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
    } finally {
      setSyncing(false);
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
    if (!identity || !env.isSupabaseEnabled() || !patientAddress) return;

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
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex items-center justify-end gap-2">
        {env.isSupabaseEnabled() ? (
          <button
            type="button"
            onClick={() => void syncSupabaseDeliveries()}
            disabled={syncing || !identity}
            className="btn-secondary text-xs"
          >
            {syncing ? "Syncing…" : "Refresh"}
          </button>
        ) : null}
        {inboxClaims.length > 0 ? (
          <span className="text-xs text-subtle">Open a claim to submit</span>
        ) : null}
      </div>
      {env.isSupabaseEnabled() && identity && !patientAddress ? (
        <div className="warning-card px-4 py-3 text-sm">
          Connect Freighter (same wallet you gave your doctor) so we can load
          claims from the directory.
        </div>
      ) : null}
      {inboxClaims.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {env.isSupabaseEnabled()
            ? "No pending claims. Claims appear automatically when your doctor sends them, or via QR/deep link."
            : "No pending claims. Ask your doctor to send a claim token via QR or deep link."}
        </p>
      ) : (
        <ul className="space-y-2">
          {inboxClaims.map((claim) => {
            const summary = identity
              ? summarizeInboxClaim(claim, identity.box_secret_key)
              : null;
            const failed = claim.status === "failed";

            return (
              <li key={claim.id}>
                <button
                  type="button"
                  onClick={() => onSelectClaim(claim.id)}
                  className="surface-row w-full px-4 py-3 text-left transition-fluid hover:scale-[1.01] hover:border-primary/35 hover:bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-[650] text-foreground">
                      {summary
                        ? `${summary.amount_label} · ${summary.icd_code} · ${summary.doctor_license_id}`
                        : "Encrypted claim"}
                    </p>
                    <span className={failed ? "badge-warning" : "badge-primary"}>
                      {failed ? "Retry" : "Open"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary
                      ? `Visit ${formatVisitDate(summary.visit_date)}`
                      : null}
                    {summary ? " · " : ""}
                    Received {new Date(claim.receivedAt).toLocaleString()}
                    {failed ? " · previous submit failed" : ""}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-subtle">
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
