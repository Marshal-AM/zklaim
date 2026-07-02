import { migrateLegacyPatientData } from "./persistence";
import { migrateLegacyCredentialSessions } from "./credentialStore";
import { loadPatientPersistence } from "./persistence";
import { patientWalletId } from "./patientWalletScope";
import { usePatientStore } from "../store/patientStore";

let hydrationToken = 0;

/** Load or clear patient OPFS state for the active Freighter wallet. */
export async function hydratePatientForWallet(
  walletAddress: string | null,
): Promise<void> {
  const token = ++hydrationToken;
  const walletId = patientWalletId(walletAddress);

  usePatientStore.getState().resetPatientSession();

  if (!walletId) {
    return;
  }

  await migrateLegacyPatientData(walletId);
  migrateLegacyCredentialSessions(walletId);

  const data = await loadPatientPersistence(walletId);
  if (token !== hydrationToken) return;

  usePatientStore.getState().loadPatientSession({
    activeWalletAddress: walletId,
    identity: data.identity,
    inbox: data.inbox,
    history: data.history,
  });
}
