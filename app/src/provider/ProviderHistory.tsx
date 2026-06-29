import { formatVisitDate } from "../lib/claimInbox";
import { formatUsdc } from "../lib/balances";
import { useProviderStore } from "../store/providerStore";

function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function formatSentAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ProviderHistory() {
  const history = useProviderStore((s) => s.history);

  if (history.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No claims sent yet. Each entry shows amount, diagnosis, visit date, and
        patient address — no medical narrative beyond ICD-10.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {history.map((entry, i) => {
        const hasDetails =
          entry.icd_code != null &&
          entry.visit_date != null &&
          entry.amount_cents != null;

        return (
          <li
            key={`${entry.claim_hash}-${i}`}
            className="surface-row px-4 py-3 text-sm min-w-0"
          >
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {hasDetails ? (
                  <p className="font-[650] text-foreground">
                    {formatUsdc(entry.amount_cents!)} · {entry.icd_code} ·{" "}
                    {entry.license_id ?? "—"}
                  </p>
                ) : (
                  <p className="font-[650] text-foreground">Claim sent</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {entry.visit_date != null ? (
                    <>Visit {formatVisitDate(entry.visit_date)} · </>
                  ) : null}
                  Patient{" "}
                  <span className="text-safe-mono">
                    {truncateMiddle(entry.patientAddress)}
                  </span>
                </p>
              </div>
              {entry.delivered_to_inbox != null ? (
                <span
                  className={
                    entry.delivered_to_inbox ? "badge-success" : "badge-primary"
                  }
                >
                  {entry.delivered_to_inbox ? "Inbox" : "Link"}
                </span>
              ) : null}
            </div>

            <p className="mt-2 text-safe-mono text-[11px] text-subtle">
              Hash {truncateMiddle(entry.claim_hash, 12, 8)}
            </p>
            <p className="mt-1 text-xs text-subtle">{formatSentAt(entry.date)}</p>
          </li>
        );
      })}
    </ul>
  );
}
