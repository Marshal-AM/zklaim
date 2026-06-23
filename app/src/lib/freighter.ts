import {
  isBrowser,
  isConnected,
  isAllowed,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
  signMessage,
} from "@stellar/freighter-api";
import { TransactionBuilder, type Transaction } from "@stellar/stellar-sdk";
import { env } from "../config/env";
import {
  freighterLog,
  freighterLogError,
  formatFreighterError,
  parseSignMessageResult,
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
  const result = await isConnected();
  freighterLog("isConnected", result);
  if (result.error) {
    throw new Error(formatFreighterError(result.error));
  }
  if (!result.isConnected) {
    throw new FreighterNotInstalledError();
  }
}

/** Freighter API v3: requestAccess / getAddress return { address, error? }. */
async function ensureFreighterAccess(): Promise<string> {
  assertFreighterAvailable();
  await assertExtensionInstalled();

  const allowed = await isAllowed();
  freighterLog("isAllowed", allowed);
  if (allowed.error) {
    throw new Error(formatFreighterError(allowed.error));
  }

  if (allowed.isAllowed) {
    try {
      const addr = await getAddress();
      freighterLog("getAddress", addr);
      if (!addr.error && addr.address) {
        return addr.address;
      }
    } catch (err) {
      freighterLogError("getAddress failed, falling back to requestAccess", err);
    }
  }

  const access = await requestAccess();
  freighterLog("requestAccess", access);
  if (access.error) {
    throw new Error(formatFreighterError(access.error));
  }
  if (!access.address) {
    throw new Error("Freighter connection cancelled");
  }
  return access.address;
}

async function assertTestnet(): Promise<void> {
  const details = await getNetwork();
  freighterLog("getNetwork", details);
  if (details.error) {
    throw new Error(formatFreighterError(details.error));
  }
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
    const conn = await isConnected();
    if (!conn.isConnected) return null;
    const allowed = await isAllowed();
    if (!allowed.isAllowed) return null;
    const addr = await getAddress();
    if (addr.error || !addr.address) return null;
    const net = await getNetwork();
    if (net.networkPassphrase !== env.networkPassphrase) return null;
    return addr.address;
  } catch {
    return null;
  }
}

export interface FreighterSignedTransaction {
  signedXdr: string;
  signed: Transaction;
}

/**
 * Sign a prepared Soroban transaction XDR as-is (no rebuild / setTimeout).
 * Reference: freighter/stellar-test — prepare → sign XDR → submit.
 */
export async function freighterSignPreparedXdr(
  preparedXdr: string,
  accountToSign: string,
): Promise<FreighterSignedTransaction> {
  await ensureFreighterAccess();
  await assertTestnet();

  freighterLog("signTransaction request (prepared XDR)", {
    accountToSign,
    preparedXdrTail: preparedXdr.slice(-16),
    preparedXdrLength: preparedXdr.length,
  });

  const result = await signTransaction(preparedXdr, {
    networkPassphrase: env.networkPassphrase,
    address: accountToSign,
  });

  const signedXdr = parseSignTransactionResult(result);
  const signed = TransactionBuilder.fromXDR(
    signedXdr,
    env.networkPassphrase,
  ) as Transaction;
  const reserialized = signed.toXDR();
  if (reserialized !== signedXdr) {
    freighterLog("warning: SDK reserialized signed XDR differs from Freighter payload", {
      originalLength: signedXdr.length,
      reserializedLength: reserialized.length,
      originalTail: signedXdr.slice(-16),
      reserializedTail: reserialized.slice(-16),
    });
  }
  (signed as Transaction & { __signedXdr?: string }).__signedXdr = signedXdr;

  return { signedXdr, signed };
}

/** @deprecated Prefer freighterSignPreparedXdr for Soroban flows. */
export async function freighterSignTransaction(
  tx: Transaction,
): Promise<Transaction> {
  const { signed } = await freighterSignPreparedXdr(tx.toXDR(), tx.source);
  return signed;
}

export async function freighterSignMessage(
  message: string,
  address: string,
): Promise<string> {
  const connected = await ensureFreighterAccess();
  await assertTestnet();

  freighterLog("signMessage request", {
    accountToSign: address,
    connectedAddress: connected,
    plainTextLength: message.length,
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
    raw = await signMessage(message, {
      networkPassphrase: env.networkPassphrase,
      address,
    });
  } catch (err) {
    freighterLogError("signMessage threw", err);
    throw err instanceof Error ? err : new Error("Freighter signMessage failed");
  }

  return parseSignMessageResult(raw);
}
