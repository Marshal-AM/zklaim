import {
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
  type Transaction,
} from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { getAdminKeypair } from "./adminWallet";
import { signPreparedSorobanInvoke } from "./sorobanWallet";
import type { ActivityLogger } from "./activityLog";

export interface InvokeResult {
  hash: string;
  status: string;
  returnValue?: xdr.ScVal;
}

export type InvokeSigner = "admin" | "freighter";

async function signTransaction(
  unsigned: Transaction,
  signer: InvokeSigner,
  signerAddress: string,
): Promise<Transaction> {
  const server = new rpc.Server(env.rpcUrl);
  const prepared = await server.prepareTransaction(unsigned);
  if (signer === "admin") {
    const kp = getAdminKeypair();
    if (kp.publicKey() !== signerAddress) {
      throw new Error(
        `Admin keypair (${kp.publicKey()}) does not match transaction source ${signerAddress}`,
      );
    }
    prepared.sign(kp);
    return prepared;
  }
  return signPreparedSorobanInvoke(prepared, env.rpcUrl, signerAddress);
}

export async function sendContractInvoke(params: {
  source: string;
  contractId: string;
  fn: string;
  args: xdr.ScVal[];
  signer: InvokeSigner;
  log?: ActivityLogger;
}): Promise<InvokeResult> {
  const log = params.log;
  log?.info(`Preparing Soroban invoke: ${params.fn}`, {
    contractId: params.contractId,
    source: params.source,
    signer: params.signer,
  });

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

  log?.info(`Signing (${params.signer})…`, { fn: params.fn });
  const signed = await signTransaction(tx, params.signer, params.source);
  log?.success("Transaction signed", { fn: params.fn });

  const sent = await server.sendTransaction(signed);
  if (sent.status === "ERROR") {
    log?.error("Broadcast failed", { hash: sent.hash });
    throw new Error(`Transaction failed: ${sent.hash}`);
  }

  log?.info("Polling for confirmation…", { hash: sent.hash });
  for (let i = 0; i < 30; i++) {
    const result = await server.getTransaction(sent.hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      const status = result.status;
      if (status === rpc.Api.GetTransactionStatus.SUCCESS) {
        log?.tx(`On-chain ${params.fn} confirmed`, sent.hash, { status });
        const success = result as rpc.Api.GetSuccessfulTransactionResponse;
        return {
          hash: sent.hash,
          status,
          returnValue: success.returnValue,
        };
      }
      log?.error(`On-chain ${params.fn} failed`, { hash: sent.hash, status });
      return { hash: sent.hash, status };
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { hash: sent.hash, status: "PENDING" };
}

export function scValToU64(val: xdr.ScVal | undefined): number | undefined {
  if (!val) return undefined;
  try {
    return Number(val.u64().toString());
  } catch {
    return undefined;
  }
}
