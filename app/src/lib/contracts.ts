import {
  Address,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { freighterSignTransaction } from "./freighter";
import { env } from "../config/env";

export interface InvokeResult {
  hash: string;
  status: string;
}

async function buildAndSendInvoke(params: {
  source: string;
  contractId: string;
  fn: string;
  args: xdr.ScVal[];
}): Promise<InvokeResult> {
  const server = new rpc.Server(env.rpcUrl);
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

  const simulated = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulated.error ?? simulated)}`,
    );
  }

  const assembled = rpc.assembleTransaction(tx, simulated).build();
  const signed = await freighterSignTransaction(assembled);
  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${sent.hash}`);
  }

  for (let i = 0; i < 30; i++) {
    const result = await server.getTransaction(sent.hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return { hash: sent.hash, status: result.status };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { hash: sent.hash, status: "PENDING" };
}

export async function enrollDoctor(params: {
  admin: string;
  licenseHash: string;
  specialtyCode: string;
  jurisdictionHash: string;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.admin,
    contractId: env.aspMemberId(),
    fn: "enroll_doctor",
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
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.admin,
    contractId: env.aspFraudId(),
    fn: "insert_pattern",
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
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.insurer,
    contractId: env.policyRegistryId(),
    fn: "register_policy",
    args: [
      new Address(params.insurer).toScVal(),
      xdr.ScVal.scvBytes(Buffer.from(params.coverageRoot.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvBytes(Buffer.from(params.boundsHash.replace(/^0x/, ""), "hex")),
      xdr.ScVal.scvU32(params.expiryLedger),
    ],
  });
}
