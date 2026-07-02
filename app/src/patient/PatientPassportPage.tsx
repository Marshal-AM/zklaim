import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
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
import { toast } from "../lib/toast";
import { HealthPassportCard } from "./HealthPassportCard";

export function PatientPassportPage() {
  const identity = usePatientStore((s) => s.identity);
  const activeWalletAddress = usePatientStore((s) => s.activeWalletAddress);
  const [store, setStore] = useState<PassportLocalStore | null>(null);
  const [onChainCount, setOnChainCount] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      if (!activeWalletAddress || !identity) {
        setStore(null);
        setOnChainCount(null);
        return;
      }
      try {
        const local = await loadPassportStore(activeWalletAddress);
        setStore(local);
        if (isPassportConfigured()) {
          const count = await readPassportLeafCount(activeWalletAddress);
          setOnChainCount(count);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load passport",
        );
      }
    })();
  }, [activeWalletAddress, identity]);

  if (!activeWalletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to view the Health Passport for this account.
        </p>
      </SectionCard>
    );
  }

  if (!identity) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Set up your identity for this wallet before using the Health Passport.
        </p>
      </SectionCard>
    );
  }

  const leafCount = store?.leaves.length ?? 0;
  const categories = store ? uniqueCategories(store) : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <HealthPassportCard
          leafCount={leafCount}
          onChainCount={onChainCount}
          categories={categories}
        />
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/patient/passport/share" className="btn-primary">
          Share a credential
        </Link>
        <Link to="/patient/passport/history" className="btn-secondary">
          View claim history (private)
        </Link>
      </div>

      {!isPassportConfigured() ? (
        <p className="text-xs text-muted-foreground">
          Passport registry contract is not configured.
        </p>
      ) : null}
    </div>
  );
}
