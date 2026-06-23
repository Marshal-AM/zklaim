import { useCallback, useEffect, useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { ErrorBanner } from "./ErrorBanner";
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

interface ProviderRegistrationProps {
  onRegistered: () => void;
}

export function ProviderRegistration({ onRegistered }: ProviderRegistrationProps) {
  const address = useWalletStore((s) => s.address);
  const [licenseId, setLicenseId] = useState<DemoLicenseId>("MD-001");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setBusy(true);
    setError(null);
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
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (!env.isSupabaseEnabled()) {
    return (
      <div className="warning-card space-y-2 p-4 text-sm">
        <p className="font-[650]">Provider registration requires Supabase</p>
        <p className="text-xs text-muted-foreground">
          Add VITE_SUPABASE_* to .env and run{" "}
          <code className="font-mono text-foreground">002_provider_profiles.sql</code>{" "}
          in the SQL Editor. Or connect the deployer wallet (
          <code className="font-mono text-foreground">INSURER_FUND_ADDRESS</code>
          ).
        </p>
      </div>
    );
  }

  return (
    <SectionCard label="Registration" title="Register as testnet provider">
      <p className="text-sm text-muted-foreground">
        Link your Freighter wallet to a demo ASP credential (MD-001 matches the
        hackathon pneumonia demo). Sign once with Freighter — no JSON editing.
      </p>
      {error ? <ErrorBanner message={error} /> : null}
      <FormField label="Demo license (on-chain ASP)">
        <select
          value={licenseId}
          onChange={(e) => setLicenseId(e.target.value as DemoLicenseId)}
          className="input-field"
        >
          {DEMO_PROVIDER_LICENSES.map((d) => (
            <option key={d.license_id} value={d.license_id}>
              {d.label}
            </option>
          ))}
        </select>
      </FormField>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRegister()}
        className="btn-primary w-full"
      >
        {busy ? "Signing…" : "Register provider wallet"}
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
