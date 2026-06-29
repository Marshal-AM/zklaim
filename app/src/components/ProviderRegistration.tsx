import { useCallback, useEffect, useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { FormField } from "./ui/FormField";
import { SectionCard } from "./ui/SectionCard";
import { env } from "../config/env";
import {
  DEMO_PROVIDER_LICENSES,
  lookupProviderProfile,
  registerProviderProfile,
  type DemoLicenseId,
} from "../lib/providerProfile";
import { freighterSignMessage } from "../lib/freighter";
import { useWalletStore } from "../store/wallet";
import { toast } from "../lib/toast";

function CredentialIcon({ specialty }: { specialty: string }) {
  const label =
    specialty === "PULM"
      ? "Pulmonology"
      : specialty === "PSY"
        ? "Psychiatry"
        : specialty === "ONC"
          ? "Oncology"
          : specialty;
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 2v2" />
      <path d="M5 2v2" />
      <path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1" />
      <path d="M8 15a6 6 0 0 0 12 0v-3" />
      <circle cx="20" cy="10" r="2" />
      <title>{label}</title>
    </svg>
  );
}

interface ProviderRegistrationProps {
  onRegistered: () => void;
  defaultLicenseId?: DemoLicenseId;
  mode?: "register" | "change";
}

export function ProviderRegistration({
  onRegistered,
  defaultLicenseId = "MD-001",
  mode = "register",
}: ProviderRegistrationProps) {
  const address = useWalletStore((s) => s.address);
  const [licenseId, setLicenseId] = useState<DemoLicenseId>(defaultLicenseId);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLicenseId(defaultLicenseId);
  }, [defaultLicenseId]);

  async function handleRegister() {
    setBusy(true);
    try {
      const wallet = address ?? (await ensureWalletConnected());
      if (!env.isSupabaseEnabled()) {
        throw new Error(
          "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then run supabase/migrations/002_provider_profiles.sql",
        );
      }
      await registerProviderProfile({
        address: wallet,
        licenseId,
        signMessage: freighterSignMessage,
      });
      toast.success(
        mode === "change"
          ? `Credential updated to ${licenseId}`
          : "Provider wallet registered",
      );
      onRegistered();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (!env.isSupabaseEnabled()) {
    return (
      <SectionCard label="Setup required" title="Provider registration requires Supabase">
        <p className="text-sm text-muted-foreground">
          Add VITE_SUPABASE_* to .env and run{" "}
          <code className="font-mono text-foreground">002_provider_profiles.sql</code>{" "}
          in the SQL Editor. Or connect the deployer wallet (
          <code className="font-mono text-foreground">INSURER_FUND_ADDRESS</code>
          ).
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      label={mode === "change" ? "Credential" : "Registration"}
      title={
        mode === "change"
          ? "Change demo ASP credential"
          : "Register as testnet provider"
      }
    >
      <p className="text-sm text-muted-foreground">
        {mode === "change"
          ? "Pick which on-chain doctor credential this wallet signs claims with. MD-001 is the pneumonia demo (J18.9)."
          : "Link your Freighter wallet to a demo ASP credential (MD-001 matches the hackathon pneumonia demo). Sign once with Freighter — no JSON editing."}
      </p>

      <FormField label="Choose credential" hint="Each option maps to an on-chain ASP leaf.">
        <div className="grid gap-3 sm:grid-cols-3">
          {DEMO_PROVIDER_LICENSES.map((d) => {
            const selected = licenseId === d.license_id;
            return (
              <button
                key={d.license_id}
                type="button"
                onClick={() => setLicenseId(d.license_id)}
                className={`choice-card text-left ${selected ? "choice-card--selected" : ""}`}
              >
                <div className="choice-card__icon">
                  <CredentialIcon specialty={d.specialty_code} />
                </div>
                <span className="choice-card__title">{d.license_id}</span>
                <span className="choice-card__desc">{d.label}</span>
              </button>
            );
          })}
        </div>
      </FormField>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRegister()}
        className="btn-primary mt-4 w-full"
      >
        {busy ? "Signing…" : mode === "change" ? "Update credential" : "Register provider wallet"}
      </button>
    </SectionCard>
  );
}

export function useProviderEnrollment(address: string | null) {
  const [seedPhysicians, setSeedPhysicians] = useState<
    Array<{
      wallet_address: string;
      license_id: string;
      specialty_code: string;
      jurisdiction: string;
    }>
  >([]);
  const [supabaseProfile, setSupabaseProfile] = useState<Awaited<
    ReturnType<typeof lookupProviderProfile>
  > | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/seed/physicians.json")
      .then((r) => r.json())
      .then((p: { enrolled: typeof seedPhysicians }) =>
        setSeedPhysicians(p.enrolled),
      );
  }, []);

  const refresh = useCallback(() => {
    if (!address) {
      setSupabaseProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void lookupProviderProfile(address)
      .then(setSupabaseProfile)
      .catch(() => setSupabaseProfile(null))
      .finally(() => setLoading(false));
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const seedMatch = address
    ? seedPhysicians.find((p) => p.wallet_address === address)
    : undefined;

  const enrolled =
    !!address &&
    (!!seedMatch ||
      !!supabaseProfile ||
      address === env.insurerFundAddress());

  const physician =
    seedMatch ??
    supabaseProfile ??
    (address === env.insurerFundAddress()
      ? seedPhysicians.find((p) => p.license_id === "MD-001")
      : undefined);

  return { enrolled, physician, loading, refresh };
}
