import { opfsReadJson, opfsWriteJson } from "./opfs";
import type {
  PatientIdentity,
  InboxClaim,
  ClaimHistoryEntry,
} from "../types/patient";
import type { ProviderHistoryEntry } from "../store/providerStore";

const IDENTITY_KEY = "patient_identity.json";
const INBOX_KEY = "patient_inbox.json";
const HISTORY_KEY = "patient_history.json";
const PROVIDER_HISTORY_KEY = "provider_history.json";

export async function loadPatientPersistence(): Promise<{
  identity: PatientIdentity | null;
  inbox: InboxClaim[];
  history: ClaimHistoryEntry[];
}> {
  const [identity, inbox, history] = await Promise.all([
    opfsReadJson<PatientIdentity>(IDENTITY_KEY),
    opfsReadJson<InboxClaim[]>(INBOX_KEY),
    opfsReadJson<ClaimHistoryEntry[]>(HISTORY_KEY),
  ]);
  return {
    identity,
    inbox: inbox ?? [],
    history: history ?? [],
  };
}

export async function savePatientIdentity(identity: PatientIdentity): Promise<void> {
  await opfsWriteJson(IDENTITY_KEY, identity);
}

export async function savePatientInbox(inbox: InboxClaim[]): Promise<void> {
  await opfsWriteJson(INBOX_KEY, inbox);
}

export async function savePatientHistory(
  history: ClaimHistoryEntry[],
): Promise<void> {
  await opfsWriteJson(HISTORY_KEY, history);
}

export async function loadProviderHistory(): Promise<ProviderHistoryEntry[]> {
  return (await opfsReadJson<ProviderHistoryEntry[]>(PROVIDER_HISTORY_KEY)) ?? [];
}

export async function saveProviderHistory(
  history: ProviderHistoryEntry[],
): Promise<void> {
  await opfsWriteJson(PROVIDER_HISTORY_KEY, history);
}
