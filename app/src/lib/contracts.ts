import {
  Address,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { signPreparedSorobanInvoke } from "./sorobanWallet";
import type { ActivityLogger } from "./activityLog";

export interface InvokeResult {
  hash: string;
  status: string;
}

async function buildAndSendInvoke(params: {
  source: string;
  contractId: string;
  fn: string;
  args: xdr.ScVal[];
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const log = params.log;
  log?.info(`Preparing Soroban invoke: ${params.fn}`, {
    contractId: params.contractId,
    source: params.source,
    rpcUrl: env.rpcUrl,
  });

  const server = new rpc.Server(env.rpcUrl);
  log?.info("Fetching source account from RPC…", { source: params.source });
  const account = await server.getAccount(params.source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: env.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: params.contractId,
        function: params.fn,
        args: params.args,
      }),
    )
    .setTimeout(300)
    .build();

  log?.info("Simulating + signing via Freighter…", { fn: params.fn });
  const signed = await signPreparedSorobanInvoke(
    tx,
    env.rpcUrl,
    params.source,
  );
  log?.success("Transaction signed", { fn: params.fn });

  log?.info("Broadcasting transaction…", { fn: params.fn });
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    log?.error("Transaction broadcast failed", {
      hash: sent.hash,
      error: sent.errorResult?.toXDR("base64"),
    });
    throw new Error(`Transaction failed: ${sent.hash}`);
  }

  log?.info("Polling ledger for confirmation…", { hash: sent.hash });
  for (let i = 0; i < 30; i++) {
    const result = await server.getTransaction(sent.hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) {
        log?.tx(`On-chain ${params.fn} confirmed`, sent.hash, {
          status: result.status,
        });
      } else {
        log?.error(`On-chain ${params.fn} failed`, {
          hash: sent.hash,
          status: result.status,
        });
      }
      return { hash: sent.hash, status: result.status };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  log?.warn("Transaction still pending after polling", { hash: sent.hash });
  return { hash: sent.hash, status: "PENDING" };
}

export async function enrollDoctor(params: {
  admin: string;
  licenseHash: string;
  specialtyCode: string;
  jurisdictionHash: string;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.admin,
    contractId: env.aspMemberId(),
    fn: "enroll_doctor",
    log: params.log,
    args: [
      new Address(params.admin).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.licenseHash, "hex")),
      xdr.ScVal.scvBytes(Buffer.from(params.specialtyCode.padEnd(32, "\0")).slice(0, 32)),
      xdr.ScVal.scvBytes(Buffer.from(params.jurisdictionHash, "hex")),
    ],
  });
}

export async function insertFraudPattern(params: {
  admin: string;
  patternHash: string;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.admin,
    contractId: env.aspFraudId(),
    fn: "insert_pattern",
    log: params.log,
    args: [
      new Address(params.admin).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.patternHash.replace(/^0x/, ""), "hex")),
    ],
  });
}

export async function registerPolicy(params: {
  insurer: string;
  coverageRoot: string;
  boundsHash: string;
  expiryLedger: number;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.insurer,
    contractId: env.policyRegistryId(),
    fn: "register_policy",
    log: params.log,
    args: [
      new Address(params.insurer).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.coverageRoot.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvBytes(Buffer.from(params.boundsHash.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvU32(params.expiryLedger),
    ],
  });
}
