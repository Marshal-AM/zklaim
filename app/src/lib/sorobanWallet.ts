import { signAuthEntry } from "@stellar/freighter-api";
import {
  authorizeEntry,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import {
  authEntryNeedsPatientSignature,
  logSimulation,
  logSorobanDebug,
  logSorobanTx,
  logTxCompare,
  type SorobanDebugSink,
} from "@zklaim/proof-gen/stellar/sorobanDebug";
import {
  formatFreighterError,
  freighterLog,
  parseSignAuthEntryResult,
} from "./freighterDebug";
import { freighterSignPreparedXdr } from "./freighter";
import { restoreExpiredFootprintEntries } from "./sorobanFootprint";

export interface SignSorobanClaimOptions {
  debug?: SorobanDebugSink;
  attempt?: number;
}

function extSwitchValue(tx: Transaction): number | undefined {
  const extSwitch = tx.toEnvelope().v1()?.tx()?.ext()?.switch();
  if (typeof extSwitch === "number") return extSwitch;
  return (extSwitch as { value?: number } | undefined)?.value;
}

function isSorobanPrepared(tx: Transaction): boolean {
  const op = tx.operations[0];
  if (op?.type !== "invokeHostFunction") return false;
  const extValue = extSwitchValue(tx);
  return extValue !== undefined && extValue !== 0;
}

function assertHasSorobanData(tx: Transaction, stage: string): void {
  if (!isSorobanPrepared(tx)) {
    throw new Error(
      `Transaction missing Soroban metadata after ${stage} (ext=${extSwitchValue(tx)}). Update Freighter and retry.`,
    );
  }
}

export function extractSorobanData(tx: Transaction): xdr.SorobanTransactionData {
  const ext = tx.toEnvelope().v1()?.tx()?.ext();
  const extValue = extSwitchValue(tx);
  if (extValue !== 1 || !ext) {
    throw new Error("Transaction has no Soroban transaction data");
  }
  return ext.sorobanData();
}

function txBodyHashHex(tx: Transaction): string {
  return tx.hash().toString("hex");
}

async function signAuthEntriesForPatient(
  authEntries: xdr.SorobanAuthorizationEntry[],
  signerAddress: string,
  validUntilLedger: number,
  networkPassphrase: string,
  debug: SorobanDebugSink | undefined,
  stage: string,
): Promise<xdr.SorobanAuthorizationEntry[]> {
  const needsSigning = authEntries.some((entry) =>
    authEntryNeedsPatientSignature(entry, signerAddress),
  );
  if (!needsSigning) return authEntries;

  logSorobanDebug(debug, "info", `${stage}: signing patient auth entries`, {
    total: authEntries.length,
    signer: signerAddress,
    validUntilLedger,
  });

  freighterLog("signing Soroban auth entries (approve first Freighter prompt)", {
    total: authEntries.length,
    signer: signerAddress,
    validUntilLedger,
  });

  return Promise.all(
    authEntries.map(async (entry) => {
      if (!authEntryNeedsPatientSignature(entry, signerAddress)) return entry;
      const signed = await authorizeEntry(
        entry,
        async (preimage) => {
          const preimageXdr = preimage.toXDR("base64");
          const result = await signAuthEntry(preimageXdr, {
            networkPassphrase,
            address: signerAddress,
          });
          if (result.error) {
            throw new Error(formatFreighterError(result.error));
          }
          return parseSignAuthEntryResult(result);
        },
        validUntilLedger,
        networkPassphrase,
      );
      return signed;
    }),
  );
}

function replaceInvokeAuthPreservingSoroban(
  tx: Transaction,
  signedAuth: xdr.SorobanAuthorizationEntry[],
  networkPassphrase: string,
): Transaction {
  const sorobanData = extractSorobanData(tx);
  const op = tx.operations[0];
  if (op.type !== "invokeHostFunction") {
    throw new Error("Expected Soroban invokeHostFunction operation");
  }

  return TransactionBuilder.cloneFrom(tx, {
    fee: tx.fee,
    sorobanData,
    networkPassphrase,
  })
    .clearOperations()
    .addOperation(
      Operation.invokeHostFunction({
        source: op.source,
        func: op.func,
        auth: signedAuth,
      }),
    )
    .build();
}

async function refreshUnsignedAccount(
  unsigned: Transaction,
  server: rpc.Server,
): Promise<Transaction> {
  const account = await server.getAccount(unsigned.source);
  const op = unsigned.operations[0];
  if (op.type !== "invokeHostFunction") {
    throw new Error(`Expected invokeHostFunction, got ${op.type}`);
  }
  return new TransactionBuilder(account, {
    fee: unsigned.fee,
    networkPassphrase: unsigned.networkPassphrase,
  })
    .addOperation(
      Operation.invokeHostFunction({
        source: op.source,
        func: op.func,
        auth: op.auth,
      }),
    )
    .setTimeout(30)
    .build();
}

async function prepareClaimTransaction(
  unsigned: Transaction,
  server: rpc.Server,
  networkPassphrase: string,
  signerAddress: string,
  debug: SorobanDebugSink | undefined,
  patientOpts: { attempt?: number; patientAddress: string },
): Promise<Transaction> {
  let prepared: Transaction;
  try {
    prepared = await server.prepareTransaction(unsigned);
  } catch (err) {
    const simulated = await server.simulateTransaction(unsigned);
    if (rpc.Api.isSimulationError(simulated)) {
      logSimulation(debug, simulated, "simulate-error");
      throw new Error(
        `Simulation failed: ${JSON.stringify(simulated.error ?? simulated)}`,
      );
    }
    throw err;
  }

  assertHasSorobanData(prepared, "prepare");
  logSorobanTx(debug, prepared, "prepared", patientOpts);

  const preparedOp = prepared.operations[0];
  if (preparedOp.type !== "invokeHostFunction") {
    return prepared;
  }

  const authEntries = preparedOp.auth ?? [];
  let candidate = prepared;
  if (authEntries.some((e) => authEntryNeedsPatientSignature(e, signerAddress))) {
    const latest = await server.getLatestLedger();
    const signedOpAuth = await signAuthEntriesForPatient(
      authEntries,
      signerAddress,
      latest.sequence + 100,
      networkPassphrase,
      debug,
      "post-prepare",
    );
    candidate = replaceInvokeAuthPreservingSoroban(
      prepared,
      signedOpAuth,
      networkPassphrase,
    );
    logSorobanTx(debug, candidate, "post-prepare-auth", patientOpts);
  }

  // Always enforce-simulate right before signing so Soroban metadata/resources
  // are fully validated for this exact candidate tx.
  const enforceSim = await server.simulateTransaction(
    candidate,
    undefined,
    "enforce",
  );
  if (rpc.Api.isSimulationError(enforceSim)) {
    logSimulation(debug, enforceSim, "enforce-sim-error");
    throw new Error(
      `Auth validation failed: ${JSON.stringify(enforceSim.error ?? enforceSim)}`,
    );
  }
  logSimulation(debug, enforceSim, "enforce-sim");
  const assembled = rpc.assembleTransaction(candidate, enforceSim).build();
  logSorobanTx(debug, assembled, "assembled-enforce", patientOpts);
  return assembled;
}

/**
 * Stellar reference flow (freighter/stellar-test):
 *   prepareTransaction → [optional TTL restore] → Freighter sign → submit immediately
 */
export async function signSorobanClaimTransaction(
  unsigned: Transaction,
  rpcUrl: string,
  networkPassphrase: string,
  signerAddress: string,
  options: SignSorobanClaimOptions = {},
): Promise<Transaction> {
  const debug = options.debug;
  const attempt = options.attempt;
  const patientOpts = { attempt, patientAddress: signerAddress };

  logSorobanTx(debug, unsigned, "unsigned", patientOpts);

  const server = new rpc.Server(rpcUrl);
  let workUnsigned = unsigned;

  let readyToSign = await prepareClaimTransaction(
    workUnsigned,
    server,
    networkPassphrase,
    signerAddress,
    debug,
    patientOpts,
  );

  const restored = await restoreExpiredFootprintEntries(
    server,
    readyToSign,
    signerAddress,
    networkPassphrase,
    debug,
  );

  if (restored) {
    logSorobanDebug(debug, "info", "re-simulating after footprint restore", {});
    workUnsigned = await refreshUnsignedAccount(workUnsigned, server);
  }

  // Fresh simulate immediately before Freighter — avoids txSorobanInvalid from stale sorobanData.
  workUnsigned = await refreshUnsignedAccount(workUnsigned, server);
  readyToSign = await prepareClaimTransaction(
    workUnsigned,
    server,
    networkPassphrase,
    signerAddress,
    debug,
    patientOpts,
  );

  assertHasSorobanData(readyToSign, "pre-sign");
  const preSignSnap = logSorobanTx(debug, readyToSign, "pre-freighter", patientOpts);
  const preparedXdr = readyToSign.toXDR();
  const preparedBodyHash = txBodyHashHex(readyToSign);
  const expectedSorobanXdr = extractSorobanData(readyToSign).toXDR("base64");

  logSorobanDebug(debug, "info", "pre-freighter checks", {
    fee: preSignSnap.fee,
    resourceFee: preSignSnap.resourceFee,
    feeEquationOk: preSignSnap.feeEquationOk,
    txBodyHash: preparedBodyHash,
  });

  freighterLog("signing prepared XDR (approve Freighter prompt)", {
    fee: readyToSign.fee,
    txBodyHash: preparedBodyHash,
  });

  const { signed } = await freighterSignPreparedXdr(
    preparedXdr,
    signerAddress,
  );

  const postSignSnap = logSorobanTx(debug, signed, "post-freighter", patientOpts);
  logTxCompare(debug, preSignSnap, postSignSnap, "pre-freighter vs post-freighter");

  const signedBodyHash = txBodyHashHex(signed);
  const bodyHashOk = signedBodyHash === preparedBodyHash;
  logSorobanDebug(debug, bodyHashOk ? "info" : "error", "post-sign integrity check", {
    preparedBodyHash,
    signedBodyHash,
    bodyHashOk,
  });

  if (!bodyHashOk) {
    throw new Error(
      "Freighter changed the transaction body after signing. Check network/passphrase and update Freighter.",
    );
  }

  const signedSorobanXdr = extractSorobanData(signed).toXDR("base64");
  if (signedSorobanXdr !== expectedSorobanXdr) {
    throw new Error(
      "Freighter returned a transaction without matching Soroban metadata. Update Freighter to the latest version and retry.",
    );
  }

  return signed;
}

export function assertSorobanTransactionReady(tx: Transaction): void {
  assertHasSorobanData(tx, "sign");
}

/** prepare → Freighter sign for admin contract invokes (enroll, policy, etc.). */
export async function signPreparedSorobanInvoke(
  unsigned: Transaction,
  rpcUrl: string,
  signerAddress: string,
  debug?: SorobanDebugSink,
): Promise<Transaction> {
  const server = new rpc.Server(rpcUrl);
  const prepared = await server.prepareTransaction(unsigned);
  assertHasSorobanData(prepared, "prepare");
  logSorobanTx(debug, prepared, "prepared-admin", {});
  const { signed } = await freighterSignPreparedXdr(
    prepared.toXDR(),
    signerAddress,
  );
  return signed;
}
