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
import { hexToBytes, bytesToHex } from "./passport";

/** SDK types expect Buffer; browser runtime accepts Uint8Array. */
function scvBytesU8(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(bytes as unknown as Buffer);
}

export interface InvokeResult {
  hash: string;
  status: string;
}

function passportEnabled(): boolean {
  return Boolean(import.meta.env.VITE_PASSPORT_REGISTRY_CONTRACT_ID);
}

export function isPassportConfigured(): boolean {
  return passportEnabled();
}

export function passportRegistryId(): string {
  const id = import.meta.env.VITE_PASSPORT_REGISTRY_CONTRACT_ID;
  if (!id) {
    throw new Error(
      "VITE_PASSPORT_REGISTRY_CONTRACT_ID not set — deploy passport_registry and add to .env",
    );
  }
  return id;
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

  const signed = await signPreparedSorobanInvoke(
    tx,
    env.rpcUrl,
    params.source,
  );
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

export async function appendPassportLeaf(params: {
  patient: string;
  nullifierHex: string;
  leafCommitmentHex: string;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.patient,
    contractId: passportRegistryId(),
    fn: "append_leaf",
    args: [
      new Address(params.patient).toScVal(),
      scvBytesU8(hexToBytes(params.nullifierHex)),
      scvBytesU8(hexToBytes(params.leafCommitmentHex)),
    ],
  });
}

export async function readPassportRoot(patient: string): Promise<string> {
  const server = new rpc.Server(env.rpcUrl);
  const contract = passportRegistryId();
  const tx = new TransactionBuilder(
    await server.getAccount(patient),
    { fee: BASE_FEE, networkPassphrase: env.networkPassphrase },
  )
    .addOperation(
      Operation.invokeContractFunction({
        contract,
        function: "get_root",
        args: [new Address(patient).toScVal()],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const val = sim.result?.retval;
  if (!val) return "0x" + "00".repeat(32);
  return bytesToHex(new Uint8Array(val.bytes()));
}

export async function readPassportLeafCount(patient: string): Promise<number> {
  const server = new rpc.Server(env.rpcUrl);
  const contract = passportRegistryId();
  const tx = new TransactionBuilder(
    await server.getAccount(patient),
    { fee: BASE_FEE, networkPassphrase: env.networkPassphrase },
  )
    .addOperation(
      Operation.invokeContractFunction({
        contract,
        function: "get_leaf_count",
        args: [new Address(patient).toScVal()],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const val = sim.result?.retval;
  return val ? Number(val.u32()) : 0;
}

export async function registerPassportVerifier(params: {
  admin: string;
  verifier: string;
  permitted: boolean;
}): Promise<InvokeResult> {
  return buildAndSendInvoke({
    source: params.admin,
    contractId: passportRegistryId(),
    fn: "register_verifier",
    args: [
      new Address(params.admin).toScVal(),
      new Address(params.verifier).toScVal(),
      xdr.ScVal.scvBool(params.permitted),
    ],
  });
}

export async function verifyPassportCredential(params: {
  patient: string;
  verifier: string;
  circuitId: number;
  publicInputHex: string[];
  proof: Uint8Array;
  ttlLedgers: number;
}): Promise<InvokeResult & { credentialId?: number }> {
  const result = await buildAndSendInvoke({
    source: params.patient,
    contractId: passportRegistryId(),
    fn: "verify_credential",
    args: [
      new Address(params.patient).toScVal(),
      new Address(params.verifier).toScVal(),
      xdr.ScVal.scvU32(params.circuitId),
      xdr.ScVal.scvVec(
        params.publicInputHex.map((h) => scvBytesU8(hexToBytes(h))),
      ),
      scvBytesU8(params.proof),
      xdr.ScVal.scvU32(params.ttlLedgers),
    ],
  });
  return result;
}

export async function isPassportCredentialValid(
  credentialId: number,
): Promise<boolean> {
  const server = new rpc.Server(env.rpcUrl);
  const contract = passportRegistryId();
  const source = env.insurerFundAddress();
  const tx = new TransactionBuilder(
    await server.getAccount(source),
    { fee: BASE_FEE, networkPassphrase: env.networkPassphrase },
  )
    .addOperation(
      Operation.invokeContractFunction({
        contract,
        function: "is_credential_valid",
        args: [xdr.ScVal.scvU64(xdr.Uint64.fromString(String(credentialId)))],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  return sim.result?.retval?.b() ?? false;
}

export async function fetchPassportMerklePath(
  patient: string,
  index: number,
): Promise<string[]> {
  const server = new rpc.Server(env.rpcUrl);
  const contract = passportRegistryId();
  const source = env.insurerFundAddress();
  const tx = new TransactionBuilder(
    await server.getAccount(source),
    { fee: BASE_FEE, networkPassphrase: env.networkPassphrase },
  )
    .addOperation(
      Operation.invokeContractFunction({
        contract,
        function: "get_merkle_path",
        args: [new Address(patient).toScVal(), xdr.ScVal.scvU32(index)],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const vec = sim.result?.retval?.vec();
  if (!vec) return [];
  return vec.map((v) => bytesToHex(new Uint8Array(v.bytes())));
}
