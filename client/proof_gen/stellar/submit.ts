import { rpc, type Transaction } from "@stellar/stellar-sdk";
import { decodeSubmitErrorXdr } from "./errors.js";

export interface SubmitClaimParams {
  rpcUrl: string;
  /** Build unsigned → simulate once → Freighter sign → return signed tx. */
  signTransaction: () => Promise<Transaction>;
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export interface SubmitClaimResult {
  hash: string;
  status: string;
  result?: rpc.Api.GetTransactionResponse;
}

export async function submitClaim(
  params: SubmitClaimParams,
): Promise<SubmitClaimResult> {
  const server = new rpc.Server(params.rpcUrl);
  const signed = await params.signTransaction();
  const sent = await server.sendTransaction(signed);

  if (sent.status === "ERROR") {
    const detail = decodeSubmitErrorXdr(sent.errorResult?.toXDR("base64"));
    throw new Error(`sendTransaction failed: ${detail}`);
  }

  const hash = sent.hash;
  const pollInterval = params.pollIntervalMs ?? 1000;
  const maxAttempts = params.maxAttempts ?? 60;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await server.getTransaction(hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return {
        hash,
        status: result.status,
        result,
      };
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`Transaction ${hash} not confirmed after polling`);
}
