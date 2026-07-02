import { useEffect, useState } from "react";
import { SectionCard } from "../components/ui/SectionCard";
import { loadPassportStore } from "../lib/passportStore";
import { formatAmountBucketLabel } from "../lib/passport";
import { ICD_CATEGORY_NAMES } from "../lib/passportCategories";
import type { PassportLocalStore } from "../lib/passport";
import { usePatientStore } from "../store/patientStore";

function monthLabel(visitMonth: number): string {
  const year = Math.floor(visitMonth / 12);
  const month = visitMonth % 12;
  return new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PatientPassportHistoryPage() {
  const activeWalletAddress = usePatientStore((s) => s.activeWalletAddress);
  const identity = usePatientStore((s) => s.identity);
  const [store, setStore] = useState<PassportLocalStore | null>(null);

  useEffect(() => {
    if (!activeWalletAddress || !identity) {
      setStore(null);
      return;
    }
    void loadPassportStore(activeWalletAddress).then(setStore);
  }, [activeWalletAddress, identity]);

  const leaves = [...(store?.leaves ?? [])].reverse();

  if (!activeWalletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to view passport history for this account.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      label="Private history"
      title="My claim history (visible only to you)"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        This history is stored per wallet on this device. Amounts are bucketed
        ranges; exact diagnosis codes are not stored in the passport.
      </p>
      {leaves.length === 0 ? (
        <p className="text-sm text-muted-foreground">No passport claims yet.</p>
      ) : (
        <ul className="space-y-3">
          {leaves.map((leaf, i) => (
            <li key={`${leaf.nullifier}-${i}`} className="surface-row px-4 py-3">
              <p className="font-[650]">
                Claim #{leaf.leaf_index + 1} · {monthLabel(leaf.visit_month)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {ICD_CATEGORY_NAMES[leaf.icd_category] ?? leaf.icd_category} ·{" "}
                {formatAmountBucketLabel(leaf.amount_bucket)} · Settled ✓
              </p>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
