/**
 * Footprint TTL restore (see freighter/stellar-test/src/soroban.ts).
 *
 * Restore only when getLedgerEntries returns a live entry near/past TTL.
 * Empty RPC = key never written (e.g. fraud Leaf has() for non-membership) — not restorable.
 */

import {
  BASE_FEE,
  Operation,
  rpc,
  SorobanDataBuilder,
  TransactionBuilder,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import { logSorobanDebug, type SorobanDebugSink } from "@zklaim/proof-gen/stellar/sorobanDebug";
import { freighterSignPreparedXdr } from "./freighter";

const TTL_BUFFER_LEDGERS = 5;

function extractSorobanData(tx: Transaction): xdr.SorobanTransactionData {
  const ext = tx.toEnvelope().v1()?.tx()?.ext();
  if (!ext || ext.switch() !== 1) {
    throw new Error("Transaction has no Soroban transaction data");
  }
  return ext.sorobanData();
}

function ledgerKeyPreview(key: xdr.LedgerKey): string {
  return key.toXDR("base64").slice(0, 40);
}

function ledgerKeyId(key: xdr.LedgerKey): string {
  return key.toXDR("base64");
}

/** Only persistent contract ledger keys can be archived and restored. */
function isRestorableLedgerKey(key: xdr.LedgerKey): boolean {
  const type = key.switch().name;
  if (type === "contractCode") return true;
  if (type === "contractData") {
    return key.contractData().durability().name === "persistent";
  }
  return false;
}

function dedupeLedgerKeys(keys: xdr.LedgerKey[]): xdr.LedgerKey[] {
  const seen = new Set<string>();
  const out: xdr.LedgerKey[] = [];
  for (const key of keys) {
    const id = ledgerKeyId(key);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(key);
  }
  return out;
}

/**
 * Check footprint TTLs; restore entries that exist on-chain but are past TTL.
 * Returns true when a restore tx was confirmed (caller must re-simulate).
 */
export async function restoreExpiredFootprintEntries(
  server: rpc.Server,
  preparedTx: Transaction,
  sourceAddress: string,
  networkPassphrase: string,
  debug: SorobanDebugSink | undefined,
): Promise<boolean> {
  const footprint = extractSorobanData(preparedTx).resources().footprint();
  const allKeys = dedupeLedgerKeys([
    ...footprint.readOnly(),
    ...footprint.readWrite(),
  ]);

  logSorobanDebug(debug, "info", "footprint TTL check", {
    uniqueKeyCount: allKeys.length,
    readOnlyCount: footprint.readOnly().length,
    readWriteCount: footprint.readWrite().length,
  });

  let currentLedger: number;
  try {
    const ledger = await server.getLatestLedger();
    currentLedger = ledger.sequence;
  } catch {
    logSorobanDebug(debug, "warn", "could not fetch latest ledger for TTL check", {});
    return false;
  }

  const restorableKeys = allKeys.filter(isRestorableLedgerKey);

  const checkResults = await Promise.all(
    restorableKeys.map(async (key): Promise<xdr.LedgerKey | null> => {
      try {
        const entries = await server.getLedgerEntries(key);
        if (entries.entries.length === 0) {
          logSorobanDebug(
            debug,
            "info",
            "footprint key not on ledger — skip restore (never written or proof-only has())",
            {
              keyPreview: ledgerKeyPreview(key),
              keyType: key.switch().name,
            },
          );
          return null;
        }

        const entry = entries.entries[0];
        const liveUntilLedger = entry.liveUntilLedgerSeq;
        const ledgersRemaining =
          liveUntilLedger !== undefined ? liveUntilLedger - currentLedger : null;

        if (
          liveUntilLedger !== undefined &&
          liveUntilLedger <= currentLedger + TTL_BUFFER_LEDGERS
        ) {
          logSorobanDebug(debug, "warn", "footprint entry near/past TTL — needs restore", {
            keyPreview: ledgerKeyPreview(key),
            liveUntilLedger,
            currentLedger,
            ledgersRemaining,
          });
          return key;
        }

        logSorobanDebug(debug, "info", "footprint entry TTL ok", {
          keyPreview: ledgerKeyPreview(key),
          liveUntilLedger,
          ledgersRemaining,
        });
        return null;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logSorobanDebug(debug, "warn", "getLedgerEntries failed for key", {
          keyPreview: ledgerKeyPreview(key),
          msg,
        });
        return null;
      }
    }),
  );

  const uniqueExpired = dedupeLedgerKeys(
    checkResults.filter((key): key is xdr.LedgerKey => key !== null),
  );
  if (uniqueExpired.length === 0) {
    logSorobanDebug(debug, "info", "all footprint TTLs healthy — restore not needed", {});
    return false;
  }

  logSorobanDebug(debug, "warn", "restoring expired footprint entries before submit", {
    count: uniqueExpired.length,
  });

  return submitFootprintRestore(
    server,
    sourceAddress,
    networkPassphrase,
    uniqueExpired,
    debug,
  );
}

async function submitFootprintRestore(
  server: rpc.Server,
  sourceAddress: string,
  networkPassphrase: string,
  keys: xdr.LedgerKey[],
  debug: SorobanDebugSink | undefined,
): Promise<boolean> {
  if (keys.length === 0) return false;

  const account = await server.getAccount(sourceAddress);
  const restoreSorobanData = new SorobanDataBuilder()
    .setFootprint([], keys)
    .build();

  const restoreUnsigned = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(Operation.restoreFootprint({}))
    .setSorobanData(restoreSorobanData)
    .setTimeout(30)
    .build();

  let restorePrepared: Transaction;
  try {
    restorePrepared = await server.prepareTransaction(restoreUnsigned);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logSorobanDebug(debug, "warn", "restore prepare failed", {
      msg,
      keyCount: keys.length,
    });
    return false;
  }

  const { signed } = await freighterSignPreparedXdr(
    restorePrepared.toXDR(),
    sourceAddress,
  );

  const restoreResult = await server.sendTransaction(signed);
  if (restoreResult.status === "ERROR") {
    const detail = restoreResult.errorResult?.toXDR("base64") ?? "unknown";
    logSorobanDebug(debug, "warn", "restore send failed", {
      detail,
      keyCount: keys.length,
    });
    return false;
  }

  logSorobanDebug(debug, "info", "restore tx submitted — polling", {
    hash: restoreResult.hash,
    keyCount: keys.length,
  });

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await server.getTransaction(restoreResult.hash);
    if (poll.status === "SUCCESS") {
      logSorobanDebug(debug, "info", "restore tx confirmed", { polls: i + 1 });
      return true;
    }
    if (poll.status === "FAILED") {
      logSorobanDebug(debug, "warn", "restore tx failed on-chain", {
        hash: restoreResult.hash,
      });
      return false;
    }
  }

  logSorobanDebug(debug, "warn", "restore tx timed out", {
    hash: restoreResult.hash,
  });
  return false;
}
