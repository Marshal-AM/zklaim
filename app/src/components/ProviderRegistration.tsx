import { useCallback, useEffect, useState } from "react";
import { ensureWalletConnected } from "../components/WalletButton";
import { ErrorBanner } from "../components/ErrorBanner";
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
      <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 p-4 text-sm text-amber-200 space-y-2">
        <p className="font-medium">Provider registration requires Supabase</p>
        <p className="text-amber-200/80 text-xs">
          Add VITE_SUPABASE_* to .env and run{" "}
          <code className="text-amber-100">002_provider_profiles.sql</code> in
          the SQL Editor. Or connect the deployer wallet (
          <code className="text-amber-100">INSURER_FUND_ADDRESS</code>).
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-sky-900/50 bg-sky-950/20 p-4 space-y-4">
      <div>
        <h4 className="font-medium text-sky-200">Register as testnet provider</h4>
        <p className="text-xs text-slate-400 mt-1">
          Link your Freighter wallet to a demo ASP credential (MD-001 matches the
          hackathon pneumonia demo). Sign once with Freighter — no JSON editing.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      <label className="block text-sm space-y-1">
        <span className="text-slate-400">Demo license (on-chain ASP)</span>
        <select
          value={licenseId}
          onChange={(e) => setLicenseId(e.target.value as DemoLicenseId)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        >
          {DEMO_PROVIDER_LICENSES.map((d) => (
            <option key={d.license_id} value={d.license_id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleRegister()}
        className="w-full py-2 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-sm"
      >
        {busy ? "Signing…" : "Register provider wallet"}
      </button>
    </div>
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
