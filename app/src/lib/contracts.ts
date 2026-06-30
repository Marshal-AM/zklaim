import { Address, xdr } from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { resolveAdminAddress } from "./adminWallet";
import { sendContractInvoke } from "./sorobanInvoke";
import type { ActivityLogger } from "./activityLog";

export interface InvokeResult {
  hash: string;
  status: string;
}

async function buildAndSendAdminInvoke(params: {
  source: string;
  contractId: string;
  fn: string;
  args: xdr.ScVal[];
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const result = await sendContractInvoke({
    ...params,
    signer: "admin",
  });
  return { hash: result.hash, status: result.status };
}

export async function enrollDoctor(params: {
  admin?: string;
  licenseHash: string;
  specialtyCode: string;
  jurisdictionHash: string;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const admin = params.admin ?? resolveAdminAddress();
  return buildAndSendAdminInvoke({
    source: admin,
    contractId: env.aspMemberId(),
    fn: "enroll_doctor",
    log: params.log,
    args: [
      new Address(admin).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.licenseHash, "hex")),
      xdr.ScVal.scvBytes(Buffer.from(params.specialtyCode.padEnd(32, "\0")).slice(0, 32)),
      xdr.ScVal.scvBytes(Buffer.from(params.jurisdictionHash, "hex")),
    ],
  });
}

export async function insertFraudPattern(params: {
  admin?: string;
  patternHash: string;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const admin = params.admin ?? resolveAdminAddress();
  return buildAndSendAdminInvoke({
    source: admin,
    contractId: env.aspFraudId(),
    fn: "insert_pattern",
    log: params.log,
    args: [
      new Address(admin).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.patternHash.replace(/^0x/, ""), "hex")),
    ],
  });
}

export async function registerPolicy(params: {
  insurer?: string;
  coverageRoot: string;
  boundsHash: string;
  expiryLedger: number;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const insurer = params.insurer ?? resolveAdminAddress();
  return buildAndSendAdminInvoke({
    source: insurer,
    contractId: env.policyRegistryId(),
    fn: "register_policy",
    log: params.log,
    args: [
      new Address(insurer).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.coverageRoot.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvBytes(Buffer.from(params.boundsHash.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvU32(params.expiryLedger),
    ],
  });
}
