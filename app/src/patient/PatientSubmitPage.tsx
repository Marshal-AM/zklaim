import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { SubmitClaimFlow } from "./SubmitClaimFlow";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import {
  formatVisitDate,
  shortClaimId,
  summarizeInboxClaim,
} from "../lib/claimInbox";
import { TreeAlignmentBanner } from "../components/TreeAlignmentBanner";
import { SectionCard } from "../components/ui/SectionCard";

export function PatientSubmitPage() {
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId?: string }>();
  const identity = usePatientStore((s) => s.identity);
  const activeWalletAddress = usePatientStore((s) => s.activeWalletAddress);
  const walletAddress = useWalletStore((s) => s.address);
  const inbox = usePatientStore((s) => s.inbox);

  const submittable = inbox.filter(
    (c) => c.status === "pending" || c.status === "failed",
  );

  // Keep the routed claim mounted through submit → success UI (status becomes "submitted").
  const selectedClaim = claimId
    ? (inbox.find((c) => c.id === claimId) ?? null)
    : submittable.length === 1
      ? submittable[0]
      : null;

  useEffect(() => {
    if (!claimId && submittable.length === 1) {
      navigate(`/patient/submit/${submittable[0].id}`, { replace: true });
    }
  }, [claimId, submittable, navigate]);

  if (!walletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to submit claims for this account.
        </p>
      </SectionCard>
    );
  }

  if (!identity || !activeWalletAddress) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Set up your identity for this wallet before you can generate proofs and
          submit claims.
        </p>
      </SectionCard>
    );
  }

  if (!selectedClaim && submittable.length === 0) {
    return (
      <SectionCard label="Nothing to submit" title="No pending claims">
        <p className="text-sm text-muted-foreground">
          When your doctor sends a claim, it will appear in your{" "}
          <Link to="/patient/inbox" className="text-primary underline">
            inbox
          </Link>
          . Select it there to begin submission.
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <TreeAlignmentBanner />
      {submittable.length > 1 ? (
        <SectionCard label="Pending claims" title="Select a claim to submit">
          <ul className="space-y-2">
            {submittable.map((claim) => {
              const summary = summarizeInboxClaim(
                claim,
                identity.box_secret_key,
              );
              const selected = selectedClaim?.id === claim.id;
              const failed = claim.status === "failed";

              return (
                <li key={claim.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/patient/submit/${claim.id}`)}
                    className={`surface-row w-full px-4 py-3 text-left transition-fluid hover:scale-[1.01] ${
                      selected
                        ? failed
                          ? "border-[color-mix(in_oklch,oklch(0.72_0.12_55)_50%,transparent)] bg-[color-mix(in_oklch,oklch(0.72_0.12_55)_10%,transparent)]"
                          : "border-primary/50 bg-primary/10"
                        : ""
                    }`}
                  >
                    <p className="font-[650]">
                      {summary
                        ? `${summary.amount_label} · ${summary.icd_code} · ${summary.doctor_license_id}`
                        : "Encrypted claim"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {summary
                        ? `Visit ${formatVisitDate(summary.visit_date)} · `
                        : ""}
                      {failed ? "Previous submit failed · " : ""}
                      ID {shortClaimId(claim.id)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      ) : null}

      {selectedClaim ? (
        <SubmitClaimFlow
          claim={selectedClaim}
          onComplete={() => navigate("/patient/history")}
        />
      ) : (
        <SectionCard label="Select a claim" title="Choose from pending claims">
          <p className="text-sm text-muted-foreground">
            Pick a claim above, or open your{" "}
            <Link to="/patient/inbox" className="text-primary underline">
              inbox
            </Link>{" "}
            to import new deliveries.
          </p>
        </SectionCard>
      )}
    </div>
  );
}
