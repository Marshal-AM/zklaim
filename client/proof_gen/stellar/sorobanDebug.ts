import {
  Address,
  BASE_FEE,
  hash,
  type Transaction,
  xdr,
} from "@stellar/stellar-sdk";
import { rpc } from "@stellar/stellar-sdk";
import { base64ToBytes, bytesToHex, xdrObjectToBytes } from "./bytes.js";

export const NETWORK_BASE_FEE = Number(BASE_FEE);

export type SorobanDebugLevel = "info" | "warn" | "error";

export type SorobanDebugSink = (
  level: SorobanDebugLevel,
  step: string,
  data?: unknown,
) => void;

export interface AuthEntrySnapshot {
  index: number;
  credentialsType: string;
  address: string | null;
  signatureType: string | null;
  signatureExpirationLedger: number | null;
  subInvocations: number;
}

export interface SorobanTxSnapshot {
  stage: string;
  attempt?: number;
  source: string;
  sequence: string;
  fee: string;
  timeboundsMin: number | null;
  timeboundsMax: number | null;
  timeboundsExpired: boolean | null;
  secondsUntilMaxTime: number | null;
  extSwitch: number | string;
  hasSorobanExt: boolean;
  resourceFee: string | null;
  feeMinusNetworkBase: number | null;
  feeEquationOk: boolean | null;
  feeEquationExpected: string | null;
  instructions: number | null;
  readBytes: number | null;
  writeBytes: number | null;
  footprintReadOnlyCount: number;
  footprintReadWriteCount: number;
  footprintReadOnlyPreview: string[];
  footprintReadWritePreview: string[];
  operationType: string | null;
  operationSource: string | null;
  authEntryCount: number;
  unsignedAuthForPatient: string[];
  authEntries: AuthEntrySnapshot[];
  signatureCount: number;
  sorobanDataFingerprint: string | null;
  envelopeFingerprint: string | null;
  envelopeXdrByteLength: number;
  problems: string[];
}

export interface SimulationSnapshot {
  stage: string;
  latestLedger: number;
  minResourceFee: string;
  simAuthCount: number;
  costCpu: string | null;
  costMem: string | null;
  transactionDataFingerprint: string | null;
  retvalType: string | null;
  error: string | null;
}

export interface TxCompareSnapshot {
  label: string;
  leftStage: string;
  rightStage: string;
  feeMatch: boolean;
  sequenceMatch: boolean;
  sorobanDataMatch: boolean;
  authCountMatch: boolean;
  unsignedAuthLeft: string[];
  unsignedAuthRight: string[];
  problems: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fingerprint(value: { toXDR: (...args: any[]) => any }): string {
  // hash() is typed as Buffer-in but accepts Uint8Array at runtime (works in browser too)
  const h = hash(xdrObjectToBytes(value) as unknown as Buffer);
  return bytesToHex(h as unknown as Uint8Array).slice(0, 16);
}

function fingerprintBase64(xdrBase64: string): string {
  const h = hash(base64ToBytes(xdrBase64) as unknown as Buffer);
  return bytesToHex(h as unknown as Uint8Array).slice(0, 16);
}

function extSwitchValue(tx: Transaction): number | string {
  const extSwitch = tx.toEnvelope().v1()?.tx()?.ext()?.switch();
  if (typeof extSwitch === "number") return extSwitch;
  return (extSwitch as { value?: number; name?: string })?.value ??
    (extSwitch as { name?: string })?.name ??
    "unknown";
}

function tryExtractSorobanData(
  tx: Transaction,
): xdr.SorobanTransactionData | null {
  try {
    const ext = tx.toEnvelope().v1()?.tx()?.ext();
    const extValue = extSwitchValue(tx);
    if (extValue !== 1 || !ext) return null;
    return ext.sorobanData();
  } catch {
    return null;
  }
}

function snapshotAuthEntry(
  entry: xdr.SorobanAuthorizationEntry,
  index: number,
): AuthEntrySnapshot {
  const creds = entry.credentials();
  const credType = creds.switch().name;
  let address: string | null = null;
  let signatureType: string | null = null;
  let expiration: number | null = null;

  if (credType === "sorobanCredentialsAddress") {
    const addrCreds = creds.address();
    address = Address.fromScAddress(addrCreds.address()).toString();
    signatureType = addrCreds.signature().switch().name;
    expiration = addrCreds.signatureExpirationLedger();
  }

  return {
    index,
    credentialsType: credType,
    address,
    signatureType,
    signatureExpirationLedger: expiration,
    subInvocations: entry.rootInvocation().subInvocations().length,
  };
}

function coerceHashBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  return new Uint8Array(value as ArrayLike<number>);
}

function ledgerKeyPreview(key: xdr.LedgerKey): string {
  try {
    const type = key.switch().name;
    if (type === "contractData") {
      const data = key.contractData();
      const contract = Address.fromScAddress(data.contract()).toString();
      const sym = data.key().switch().name;
      return `contractData:${contract.slice(0, 8)}… key=${sym}`;
    }
    if (type === "contractCode") {
      const hashBytes = coerceHashBytes(key.contractCode().hash());
      return `contractCode:${bytesToHex(hashBytes).slice(0, 12)}…`;
    }
    return type;
  } catch {
    return key.switch().name;
  }
}

export function authEntryNeedsPatientSignature(
  entry: xdr.SorobanAuthorizationEntry,
  patientAddress: string,
): boolean {
  const creds = entry.credentials();
  if (creds.switch().name !== "sorobanCredentialsAddress") return false;
  const addr = Address.fromScAddress(creds.address().address()).toString();
  const unsigned = creds.address().signature().switch().name === "scvVoid";
  return unsigned && addr === patientAddress;
}



function readSorobanResourceBytes(resources: xdr.SorobanResources): {
  instructions: number | null;
  readBytes: number | null;
  writeBytes: number | null;
} {
  const extended = resources as xdr.SorobanResources & {
    readBytes?: () => number;
    diskReadBytes?: () => number;
    writeBytes?: () => number;
  };

  const instructions =
    typeof extended.instructions === "function"
      ? extended.instructions()
      : null;
  const readBytes =
    typeof extended.diskReadBytes === "function"
      ? extended.diskReadBytes()
      : typeof extended.readBytes === "function"
        ? extended.readBytes()
        : null;
  const writeBytes =
    typeof extended.writeBytes === "function"
      ? extended.writeBytes()
      : null;

  return { instructions, readBytes, writeBytes };
}

export function snapshotSorobanTx(
  tx: Transaction,
  stage: string,
  opts?: { attempt?: number; patientAddress?: string },
): SorobanTxSnapshot {
  const problems: string[] = [];
  const now = Math.floor(Date.now() / 1000);
  const sorobanData = tryExtractSorobanData(tx);
  const op = tx.operations[0] ?? null;

  let timeboundsMin: number | null = null;
  let timeboundsMax: number | null = null;
  let timeboundsExpired: boolean | null = null;
  let secondsUntilMaxTime: number | null = null;

  try {
    const cond = tx.toEnvelope().v1()?.tx()?.cond();
    const tb = cond?.timeBounds();
    if (tb) {
      // SDK 16 returns Uint64 for timebounds — store as-is (serialises to
      // {_value:"..."} in JSON, which matches existing log format).
      timeboundsMin = tb.minTime() as unknown as number;
      timeboundsMax = tb.maxTime() as unknown as number;
      const maxNum = Number(timeboundsMax);
      timeboundsExpired = maxNum > 0 && now > maxNum;
      secondsUntilMaxTime = maxNum > 0 ? maxNum - now : null;
      if (timeboundsExpired) {
        problems.push(`timebounds expired (max=${maxNum}, now=${now})`);
      }
    }
  } catch {
    problems.push("could not read timebounds");
  }

  const feeNum = Number(tx.fee);
  const resourceFee = sorobanData
    ? sorobanData.resourceFee().toString()
    : null;
  const feeMinusNetworkBase =
    resourceFee !== null ? feeNum - NETWORK_BASE_FEE : null;
  const feeEquationOk =
    feeMinusNetworkBase !== null && resourceFee !== null
      ? feeMinusNetworkBase === Number(resourceFee)
      : null;
  const feeEquationExpected =
    resourceFee !== null
      ? String(NETWORK_BASE_FEE + Number(resourceFee))
      : null;

  if (feeEquationOk === false) {
    problems.push(
      `fee equation broken: fee(${feeNum}) - base(${NETWORK_BASE_FEE}) = ${feeMinusNetworkBase} but resourceFee = ${resourceFee} (expected total fee ${feeEquationExpected})`,
    );
  }

  const authEntries: AuthEntrySnapshot[] = [];
  const unsignedAuthForPatient: string[] = [];
  if (op?.type === "invokeHostFunction" && op.auth) {
    op.auth.forEach((entry, index) => {
      const snap = snapshotAuthEntry(entry, index);
      authEntries.push(snap);
      if (
        opts?.patientAddress &&
        authEntryNeedsPatientSignature(entry, opts.patientAddress)
      ) {
        unsignedAuthForPatient.push(
          `auth[${index}] address=${snap.address} sig=${snap.signatureType}`,
        );
        problems.push(
          `unsigned patient auth entry at index ${index} (needs signAuthEntry)`,
        );
      }
    });
  }

  if (!sorobanData && op?.type === "invokeHostFunction") {
    problems.push("missing Soroban ext.sorobanData on envelope");
  }

  let footprintReadOnlyPreview: string[] = [];
  let footprintReadWritePreview: string[] = [];
  let instructions: number | null = null;
  let readBytes: number | null = null;
  let writeBytes: number | null = null;
  let footprintReadOnlyCount = 0;
  let footprintReadWriteCount = 0;

  if (sorobanData) {
    const resources = sorobanData.resources();
    const resourceBytes = readSorobanResourceBytes(resources);
    instructions = resourceBytes.instructions;
    readBytes = resourceBytes.readBytes;
    writeBytes = resourceBytes.writeBytes;
    const footprint = resources.footprint();
    footprintReadOnlyCount = footprint.readOnly().length;
    footprintReadWriteCount = footprint.readWrite().length;
    footprintReadOnlyPreview = footprint
      .readOnly()
      .slice(0, 6)
      .map(ledgerKeyPreview);
    footprintReadWritePreview = footprint
      .readWrite()
      .slice(0, 6)
      .map(ledgerKeyPreview);
  }

  const envelopeXdrBase64 = tx.toEnvelope().toXDR("base64");

  return {
    stage,
    attempt: opts?.attempt,
    source: tx.source,
    sequence: tx.sequence,
    fee: tx.fee,
    timeboundsMin,
    timeboundsMax,
    timeboundsExpired,
    secondsUntilMaxTime,
    extSwitch: extSwitchValue(tx),
    hasSorobanExt: sorobanData !== null,
    resourceFee,
    feeMinusNetworkBase,
    feeEquationOk,
    feeEquationExpected,
    instructions,
    readBytes,
    writeBytes,
    footprintReadOnlyCount,
    footprintReadWriteCount,
    footprintReadOnlyPreview,
    footprintReadWritePreview,
    operationType: op?.type ?? null,
    operationSource:
      op && "source" in op ? (op.source as string | undefined) ?? tx.source : tx.source,
    authEntryCount: authEntries.length,
    unsignedAuthForPatient,
    authEntries,
    signatureCount: tx.signatures.length,
    sorobanDataFingerprint: sorobanData ? fingerprint(sorobanData) : null,
    envelopeFingerprint: fingerprintBase64(envelopeXdrBase64),
    envelopeXdrByteLength: base64ToBytes(envelopeXdrBase64).length,
    problems,
  };
}

export function snapshotSimulation(
  simulated: rpc.Api.SimulateTransactionResponse,
  stage: string,
): SimulationSnapshot {
  const success = "result" in simulated ? simulated : null;
  let transactionDataFingerprint: string | null = null;
  if (
    success &&
    "transactionData" in success &&
    success.transactionData &&
    typeof success.transactionData.build === "function"
  ) {
    transactionDataFingerprint = fingerprint(
      success.transactionData.build(),
    );
  }

  // SDK 16: minResourceFee only exists on success/restore responses (not error)
  const isErr = rpc.Api.isSimulationError(simulated);
  const minResourceFee = !isErr && "minResourceFee" in simulated
    ? (simulated as rpc.Api.SimulateTransactionSuccessResponse).minResourceFee
    : "0";

  return {
    stage,
    latestLedger: simulated.latestLedger,
    minResourceFee: minResourceFee ?? "0",
    simAuthCount: success?.result?.auth?.length ?? 0,
    costCpu: null, // removed in SDK 16
    costMem: null, // removed in SDK 16
    transactionDataFingerprint,
    retvalType: success?.result?.retval
      ? success.result.retval.switch().name
      : null,
    error: "error" in simulated && simulated.error ? simulated.error : null,
  };
}

export function compareSorobanTxSnapshots(
  left: SorobanTxSnapshot,
  right: SorobanTxSnapshot,
  label: string,
): TxCompareSnapshot {
  const problems: string[] = [];
  if (left.fee !== right.fee) {
    problems.push(`fee changed ${left.fee} → ${right.fee}`);
  }
  if (left.sequence !== right.sequence) {
    problems.push(`sequence changed ${left.sequence} → ${right.sequence}`);
  }
  if (left.sorobanDataFingerprint !== right.sorobanDataFingerprint) {
    problems.push(
      `sorobanData fingerprint changed ${left.sorobanDataFingerprint} → ${right.sorobanDataFingerprint}`,
    );
  }
  if (left.authEntryCount !== right.authEntryCount) {
    problems.push(
      `auth count changed ${left.authEntryCount} → ${right.authEntryCount}`,
    );
  }
  if (right.unsignedAuthForPatient.length > 0) {
    problems.push(
      `right tx still has unsigned patient auth: ${right.unsignedAuthForPatient.join(", ")}`,
    );
  }

  return {
    label,
    leftStage: left.stage,
    rightStage: right.stage,
    feeMatch: left.fee === right.fee,
    sequenceMatch: left.sequence === right.sequence,
    sorobanDataMatch:
      left.sorobanDataFingerprint === right.sorobanDataFingerprint,
    authCountMatch: left.authEntryCount === right.authEntryCount,
    unsignedAuthLeft: left.unsignedAuthForPatient,
    unsignedAuthRight: right.unsignedAuthForPatient,
    problems,
  };
}

export function logSorobanDebug(
  sink: SorobanDebugSink | undefined,
  level: SorobanDebugLevel,
  step: string,
  data?: unknown,
): void {
  if (sink) {
    sink(level, step, data);
    return;
  }
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  if (data !== undefined) {
    fn("[ZKlaim Soroban]", step, data);
  } else {
    fn("[ZKlaim Soroban]", step);
  }
}

export function logSorobanTx(
  sink: SorobanDebugSink | undefined,
  tx: Transaction,
  stage: string,
  opts?: { attempt?: number; patientAddress?: string },
): SorobanTxSnapshot {
  const snap = snapshotSorobanTx(tx, stage, opts);
  const level: SorobanDebugLevel =
    snap.problems.length > 0 ? "warn" : "info";
  logSorobanDebug(sink, level, `tx snapshot: ${stage}`, snap);
  return snap;
}

export function logSimulation(
  sink: SorobanDebugSink | undefined,
  simulated: rpc.Api.SimulateTransactionResponse,
  stage: string,
): SimulationSnapshot {
  const snap = snapshotSimulation(simulated, stage);
  const level: SorobanDebugLevel = snap.error ? "error" : "info";
  logSorobanDebug(sink, level, `simulation: ${stage}`, snap);
  return snap;
}

export function logTxCompare(
  sink: SorobanDebugSink | undefined,
  left: SorobanTxSnapshot,
  right: SorobanTxSnapshot,
  label: string,
): TxCompareSnapshot {
  const cmp = compareSorobanTxSnapshots(left, right, label);
  const level: SorobanDebugLevel =
    cmp.problems.length > 0 ? "warn" : "info";
  logSorobanDebug(sink, level, `compare: ${label}`, cmp);
  return cmp;
}

export { tryExtractSorobanData as extractSorobanDataOrNull };
