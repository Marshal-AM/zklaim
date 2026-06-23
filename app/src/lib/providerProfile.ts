import { env } from "../config/env";
import { getSupabase } from "./supabase";

const REGISTRATION_PREFIX = "zklaim:provider:register:v1:";

/** Demo credentials that match on-chain ASP tree from setup_asp.sh */
export const DEMO_PROVIDER_LICENSES = [
  {
    license_id: "MD-001",
    specialty_code: "PULM",
    jurisdiction: "US-CA",
    label: "MD-001 — Pulmonology (Demo A)",
  },
  {
    license_id: "MD-002",
    specialty_code: "PSY",
    jurisdiction: "US-NY",
    label: "MD-002 — Psychiatry",
  },
  {
    license_id: "MD-003",
    specialty_code: "ONC",
    jurisdiction: "US-TX",
    label: "MD-003 — Oncology",
  },
] as const;

export type DemoLicenseId = (typeof DEMO_PROVIDER_LICENSES)[number]["license_id"];

export interface ProviderCredential {
  wallet_address: string;
  license_id: string;
  specialty_code: string;
  jurisdiction: string;
}

export function buildProviderRegistrationMessage(
  stellarAddress: string,
  licenseId: string,
): string {
  return `${REGISTRATION_PREFIX}${stellarAddress}:${licenseId}`;
}

export function demoCredentialForLicense(
  licenseId: string,
): Omit<ProviderCredential, "wallet_address"> | null {
  const entry = DEMO_PROVIDER_LICENSES.find((d) => d.license_id === licenseId);
  if (!entry) return null;
  return {
    license_id: entry.license_id,
    specialty_code: entry.specialty_code,
    jurisdiction: entry.jurisdiction,
  };
}

export async function registerProviderProfile(params: {
  address: string;
  licenseId: DemoLicenseId;
  signMessage: (message: string, address: string) => Promise<string>;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const cred = demoCredentialForLicense(params.licenseId);
  if (!cred) {
    throw new Error(`Unknown license: ${params.licenseId}`);
  }

  const registrationMessage = buildProviderRegistrationMessage(
    params.address,
    params.licenseId,
  );
  const registrationSig = await params.signMessage(
    registrationMessage,
    params.address,
  );

  const { error } = await supabase.from("provider_profiles").upsert(
    {
      stellar_address: params.address,
      license_id: cred.license_id,
      specialty_code: cred.specialty_code,
      jurisdiction: cred.jurisdiction,
      registration_message: registrationMessage,
      registration_sig: registrationSig,
    },
    { onConflict: "stellar_address" },
  );

  if (error) {
    throw new Error(`Failed to register provider: ${error.message}`);
  }
}

export async function lookupProviderProfile(
  stellarAddress: string,
): Promise<ProviderCredential | null> {
  if (!env.isSupabaseEnabled()) {
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("provider_profiles")
    .select("stellar_address, license_id, specialty_code, jurisdiction")
    .eq("stellar_address", stellarAddress)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up provider: ${error.message}`);
  }

  if (!data) return null;

  return {
    wallet_address: data.stellar_address,
    license_id: data.license_id,
    specialty_code: data.specialty_code,
    jurisdiction: data.jurisdiction,
  };
}
