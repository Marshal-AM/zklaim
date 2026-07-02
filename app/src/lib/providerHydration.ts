import {
  loadProviderHistory,
  migrateLegacyProviderHistory,
} from "./persistence";
import { patientWalletId } from "./patientWalletScope";
import { useProviderStore } from "../store/providerStore";

let hydrationToken = 0;

export async function hydrateProviderForWallet(
  walletAddress: string | null,
): Promise<void> {
  const token = ++hydrationToken;
  const walletId = patientWalletId(walletAddress);

  useProviderStore.setState({ history: [], activeWalletAddress: null });

  if (!walletId) return;

  await migrateLegacyProviderHistory(walletId);
  const history = await loadProviderHistory(walletId);
  if (token !== hydrationToken) return;

  useProviderStore.setState({
    activeWalletAddress: walletId,
    history,
  });
}
