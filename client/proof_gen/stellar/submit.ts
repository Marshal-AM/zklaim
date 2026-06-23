import { SorobanRpc, type Transaction } from "@stellar/stellar-sdk";

export interface SubmitClaimParams {
  tx: Transaction;
  rpcUrl: string;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  pollIntervalMs?: number;
  maxAttempts?: number;
}

export interface SubmitClaimResult {
  hash: string;
  status: string;
  result?: SorobanRpc.Api.GetTransactionResponse;
}

export async function submitClaim(
  params: SubmitClaimParams,
): Promise<SubmitClaimResult> {
  const server = new SorobanRpc.Server(params.rpcUrl);
  const signed = await params.signTransaction(params.tx);
  const sent = await server.sendTransaction(signed);

  if (sent.status === "ERROR") {
    throw new Error(
      `sendTransaction failed: ${sent.errorResult?.toXDR("base64") ?? "unknown"}`,
    );
  }

  const hash = sent.hash;
  const pollInterval = params.pollIntervalMs ?? 1000;
  const maxAttempts = params.maxAttempts ?? 60;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await server.getTransaction(hash);
    if (result.status !== SorobanRpc.Api.GetTransactionStatus.NOT_FOUND) {
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
