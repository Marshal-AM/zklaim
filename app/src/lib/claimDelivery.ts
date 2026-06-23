import type { EncryptedClaimToken } from "./claimToken";
import { env } from "../config/env";
import { getSupabase, type ClaimDeliveryRow } from "./supabase";

export async function insertClaimDelivery(params: {
  patientAddress: string;
  doctorAddress: string;
  token: EncryptedClaimToken;
  claimNonce: string;
}): Promise<string> {
  const supabase = getSupabase();
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { data, error } = await supabase
    .from("claim_deliveries")
    .insert({
      patient_address: params.patientAddress,
      doctor_address: params.doctorAddress,
      claim_nonce: params.claimNonce,
      encrypted_token: params.token,
      cid: params.token.cid,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Failed to deliver claim: ${error.message}`);
  }

  return data.id as string;
}

export async function fetchPendingDeliveries(
  patientAddress: string,
): Promise<ClaimDeliveryRow[]> {
  if (!env.isSupabaseEnabled()) {
    return [];
  }

  const supabase = getSupabase();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("claim_deliveries")
    .select("*")
    .eq("patient_address", patientAddress)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch claim deliveries: ${error.message}`);
  }

  return (data ?? []) as ClaimDeliveryRow[];
}

export async function markDeliveryImported(deliveryId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("claim_deliveries")
    .update({ status: "imported" })
    .eq("id", deliveryId)
    .eq("status", "pending");

  if (error) {
    throw new Error(`Failed to mark delivery imported: ${error.message}`);
  }
}

export async function markDeliveryClaimed(deliveryId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("claim_deliveries")
    .update({ status: "claimed" })
    .eq("id", deliveryId);

  if (error) {
    throw new Error(`Failed to mark delivery claimed: ${error.message}`);
  }
}

export function rowToEncryptedToken(
  row: ClaimDeliveryRow,
): EncryptedClaimToken {
  return row.encrypted_token as unknown as EncryptedClaimToken;
}
