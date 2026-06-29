import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
import { ensureWalletConnected } from "../lib/walletSession";
import { usePatientStore } from "../store/patientStore";
import { loadPassportStore } from "../lib/passportStore";
import {
  uniqueCategories,
  type PassportLocalStore,
} from "../lib/passport";
import {
  isPassportConfigured,
  readPassportLeafCount,
} from "../lib/passportContract";
import { ICD_CATEGORY_NAMES } from "../lib/passportCategories";
import { toast } from "../lib/toast";

export function PatientPassportPage() {
  const identity = usePatientStore((s) => s.identity);
  const [store, setStore] = useState<PassportLocalStore | null>(null);
  const [onChainCount, setOnChainCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const local = await loadPassportStore();
        setStore(local);
        if (isPassportConfigured() && identity) {
          const addr = await ensureWalletConnected().catch(() => null);
          if (addr) {
            const count = await readPassportLeafCount(addr);
            setOnChainCount(count);
          }
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load passport",
        );
      }
    })();
  }, [identity]);

  if (!identity) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Set up your identity before using the Health Passport.
        </p>
      </SectionCard>
    );
  }

  const leafCount = store?.leaves.length ?? 0;
  const categories = store ? uniqueCategories(store) : [];

  return (
    <div className="space-y-6">
      <SectionCard label="Health Passport" title="Your private medical record">
        <div>
          <p className="text-xs text-muted-foreground">Claims in passport</p>
          <p className="text-2xl font-[650] tabular-nums">{leafCount}</p>
          {onChainCount !== null ? (
            <p className="mt-1 text-xs text-subtle">
              On-chain leaves: {onChainCount}
            </p>
          ) : null}
        </div>

        {categories.length > 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            <span className="font-[650] text-foreground">Categories in history: </span>
            {categories
              .map((c) => ICD_CATEGORY_NAMES[c] ?? `Category ${c}`)
              .join(" · ")}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No claims in your passport yet. After settlement, click{" "}
            <span className="font-[650] text-foreground">Add to Passport</span> on
            the receipt (Submit tab) or on Patient → History. Passport data stays
            in this browser (OPFS) for the connected patient wallet.
          </p>
        )}
      </SectionCard>

      <div className="flex flex-wrap gap-3">
        <Link to="/patient/passport/share" className="btn-primary">
          Share a credential
        </Link>
        <Link to="/patient/passport/history" className="btn-secondary">
          View claim history (private)
        </Link>
      </div>

      {!isPassportConfigured() ? (
        <p className="text-xs text-muted-foreground">
          Passport registry contract is not configured. Deploy{" "}
          <code className="text-subtle">passport_registry</code> and set{" "}
          <code className="text-subtle">VITE_PASSPORT_REGISTRY_CONTRACT_ID</code>{" "}
          in <code className="text-subtle">.env</code> to enable on-chain append.
        </p>
      ) : null}
    </div>
  );
}
