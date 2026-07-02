import {
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { bytesToHex } from "./passport";

/** Normalize a 32-byte field root to lowercase hex without 0x. */
export function normalizeRootHex(value: string): string {
  const clean = value.replace(/^0x/i, "").toLowerCase();
  if (clean.length !== 64) {
    throw new Error(`Invalid 32-byte root: ${value}`);
  }
  return clean;
}

export function scValBytesToHex(val: xdr.ScVal): string {
  return bytesToHex(new Uint8Array(val.bytes())).replace(/^0x/i, "");
}

export async function simulateContractRead(params: {
  contractId: string;
  fn: string;
  args?: xdr.ScVal[];
  sourceAccount?: string;
}): Promise<xdr.ScVal> {
  const source =
    params.sourceAccount ??
    env.adminAddress();
  const server = new rpc.Server(env.rpcUrl);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: env.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: params.contractId,
        function: params.fn,
        args: params.args ?? [],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const val = sim.result?.retval;
  if (!val) {
    throw new Error(`Empty return value from ${params.fn}`);
  }
  return val;
}

export async function readContractRoot(
  contractId: string,
  fn = "get_root",
  args: xdr.ScVal[] = [],
): Promise<string> {
  const val = await simulateContractRead({ contractId, fn, args });
  return normalizeRootHex(scValBytesToHex(val));
}

export async function readContractU32(
  contractId: string,
  fn: string,
  args: xdr.ScVal[] = [],
): Promise<number> {
  const val = await simulateContractRead({ contractId, fn, args });
  return val.u32();
}
