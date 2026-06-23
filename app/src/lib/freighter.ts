import {
  isBrowser,
  isConnected,
  isAllowed,
  requestAccess,
  getPublicKey,
  getNetworkDetails,
  signTransaction,
  signBlob,
} from "@stellar/freighter-api";
import { TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { env } from "../config/env";
import {
  encodeBlobForFreighter,
  freighterLog,
  freighterLogError,
  parseSignBlobResult,
  parseSignTransactionResult,
} from "./freighterDebug";

export class FreighterNotInstalledError extends Error {
  constructor() {
    super(
      "Freighter extension not detected. Install it from https://www.freighter.app/ and refresh this page.",
    );
    this.name = "FreighterNotInstalledError";
  }
}

function assertFreighterAvailable(): void {
  if (!isBrowser) {
    throw new FreighterNotInstalledError();
  }
}

async function assertExtensionInstalled(): Promise<void> {
  const installed = await isConnected();
  freighterLog("isConnected", { installed });
  if (!installed) {
    throw new FreighterNotInstalledError();
  }
}

/** v2 API: requestAccess returns the public key string. */
async function ensureFreighterAccess(): Promise<string> {
  assertFreighterAvailable();
  await assertExtensionInstalled();

  const allowed = await isAllowed();
  freighterLog("isAllowed", { allowed });

  if (allowed) {
    try {
      const pk = await getPublicKey();
      freighterLog("getPublicKey", { address: pk });
      return pk;
    } catch (err) {
      freighterLogError("getPublicKey failed, falling back to requestAccess", err);
    }
  }

  const address = await requestAccess();
  freighterLog("requestAccess", { address });
  if (!address || typeof address !== "string") {
    throw new Error("Freighter connection cancelled");
  }
  return address;
}

async function assertTestnet(): Promise<void> {
  const details = await getNetworkDetails();
  freighterLog("getNetworkDetails", details);
  if (details.networkPassphrase !== env.networkPassphrase) {
    throw new Error(
      "Switch Freighter to Testnet (Settings → Network → Testnet), then try again.",
    );
  }
}

export async function connectFreighter(): Promise<string> {
  const address = await ensureFreighterAccess();
  await assertTestnet();
  return address;
}

export async function getFreighterAddress(): Promise<string | null> {
  if (!isBrowser) return null;
  try {
    if (!(await isConnected())) return null;
    if (!(await isAllowed())) return null;
    const address = await getPublicKey();
    const details = await getNetworkDetails();
    if (details.networkPassphrase !== env.networkPassphrase) return null;
    return address;
  } catch {
    return null;
  }
}

export async function freighterSignTransaction(
  tx: Transaction,
): Promise<Transaction> {
  const address = await ensureFreighterAccess();
  await assertTestnet();

  freighterLog("signTransaction request", {
    source: tx.source,
    connectedAddress: address,
    fee: tx.fee,
    operations: tx.operations.length,
  });

  const raw = await signTransaction(tx.toXDR(), {
    network: "TESTNET",
    networkPassphrase: env.networkPassphrase,
    accountToSign: tx.source,
  });

  const signedXdr = parseSignTransactionResult(raw);
  const signed = TransactionBuilder.fromXDR(
    signedXdr,
    env.networkPassphrase,
  ) as Transaction;

  return signed;
}

export async function freighterSignMessage(
  message: string,
  address: string,
): Promise<string> {
  const connected = await ensureFreighterAccess();
  await assertTestnet();

  const blob = encodeBlobForFreighter(message);

  freighterLog("signBlob request", {
    accountToSign: address,
    connectedAddress: connected,
    plainTextLength: message.length,
    base64BlobLength: blob.length,
    plainPreview: message.slice(0, 120),
    accountsMatch: address === connected,
  });

  if (address !== connected) {
    freighterLog(
      "warning: accountToSign differs from connected Freighter account — switch account in Freighter if signing fails",
    );
  }

  let raw: unknown;
  try {
    raw = await signBlob(blob, { accountToSign: address });
  } catch (err) {
    freighterLogError("signBlob threw", err);
    throw err instanceof Error
      ? err
      : new Error("Freighter signBlob failed");
  }

  return parseSignBlobResult(raw);
}
