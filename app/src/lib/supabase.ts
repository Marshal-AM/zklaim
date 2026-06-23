import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!env.isSupabaseEnabled()) {
    return null;
  }
  if (!client) {
    client = createClient(env.supabaseUrl(), env.supabaseAnonKey());
  }
  return client;
}

export interface PatientProfileRow {
  stellar_address: string;
  box_public_key: string;
  registration_message: string;
  registration_sig: string;
  key_version: number;
  created_at: string;
  updated_at: string;
}

export interface ClaimDeliveryRow {
  id: string;
  patient_address: string;
  doctor_address: string;
  claim_nonce: string;
  encrypted_token: Record<string, unknown>;
  cid: string | null;
  status: "pending" | "imported" | "claimed";
  created_at: string;
  updated_at: string;
}

export interface ProviderProfileRow {
  stellar_address: string;
  license_id: string;
  specialty_code: string;
  jurisdiction: string;
  registration_message: string;
  registration_sig: string;
  created_at: string;
  updated_at: string;
}
