import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
import { loadPassportStore } from "../lib/passportStore";
import { formatAmountBucketLabel } from "../lib/passport";
import { ICD_CATEGORY_NAMES } from "../lib/passportCategories";
import type { PassportLocalStore } from "../lib/passport";

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
  const [store, setStore] = useState<PassportLocalStore | null>(null);

  useEffect(() => {
    void loadPassportStore().then(setStore);
  }, []);

  const leaves = [...(store?.leaves ?? [])].reverse();

  return (
    <SectionCard
      label="Private history"
      title="My claim history (visible only to you)"
    >
      <p className="mb-4 text-sm text-muted-foreground">
        This history exists only on this device. Amounts are bucketed ranges; exact
        diagnosis codes are not stored in the passport.
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
      <Link to="/patient/passport" className="btn-secondary mt-4 inline-flex">
        Back to passport
      </Link>
    </SectionCard>
  );
}
