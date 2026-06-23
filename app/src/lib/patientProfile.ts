import { normalizeStellarAddress } from "./stellarAddress";
import { env } from "../config/env";
import { getSupabase } from "./supabase";

const REGISTRATION_PREFIX = "zklaim:register:v1:";

export function buildRegistrationMessage(
  stellarAddress: string,
  boxPublicKey: string,
): string {
  return `${REGISTRATION_PREFIX}${stellarAddress}:${boxPublicKey}`;
}

export async function registerPatientProfile(params: {
  address: string;
  boxPublicKey: string;
  signMessage: (message: string, address: string) => Promise<string>;
}): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const stellarAddress = normalizeStellarAddress(params.address);

  const registrationMessage = buildRegistrationMessage(
    stellarAddress,
    params.boxPublicKey,
  );
  const registrationSig = await params.signMessage(
    registrationMessage,
    stellarAddress,
  );

  const { error } = await supabase.from("patient_profiles").upsert(
    {
      stellar_address: stellarAddress,
      box_public_key: params.boxPublicKey,
      registration_message: registrationMessage,
      registration_sig: registrationSig,
      key_version: 1,
    },
    { onConflict: "stellar_address" },
  );

  if (error) {
    throw new Error(`Failed to register patient profile: ${error.message}`);
  }
}

export async function lookupBoxPublicKey(
  patientAddress: string,
): Promise<string | null> {
  if (!env.isSupabaseEnabled()) {
    return null;
  }

  const supabase = getSupabase();
  if (!supabase) {
    return null;
  }

  const stellarAddress = normalizeStellarAddress(patientAddress);

  const { data, error } = await supabase
    .from("patient_profiles")
    .select("box_public_key")
    .eq("stellar_address", stellarAddress)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up patient profile: ${error.message}`);
  }

  return data?.box_public_key ?? null;
}
