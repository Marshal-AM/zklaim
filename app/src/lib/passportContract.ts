import { Address, BASE_FEE, Operation, rpc, TransactionBuilder, xdr } from "@stellar/stellar-sdk";
import { env } from "../config/env";
import { hasAdminSigningKey, resolveAdminAddress } from "./adminWallet";
import { hexToBytes, bytesToHex } from "./passport";
import { scValToU64, sendContractInvoke } from "./sorobanInvoke";

/** SDK types expect Buffer; browser runtime accepts Uint8Array. */
function scvBytesU8(bytes: Uint8Array): xdr.ScVal {
  return xdr.ScVal.scvBytes(bytes as unknown as Buffer);
}

export interface InvokeResult {
  hash: string;
  status: string;
  credentialId?: number;
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

export async function appendPassportLeaf(params: {
  patient: string;
  nullifierHex: string;
  leafCommitmentHex: string;
}): Promise<InvokeResult> {
  const result = await sendContractInvoke({
    source: params.patient,
    contractId: passportRegistryId(),
    fn: "append_leaf",
    signer: "freighter",
    args: [
      new Address(params.patient).toScVal(),
      scvBytesU8(hexToBytes(params.nullifierHex)),
      scvBytesU8(hexToBytes(params.leafCommitmentHex)),
    ],
  });
  return { hash: result.hash, status: result.status };
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
  const result = await sendContractInvoke({
    source: params.admin,
    contractId: passportRegistryId(),
    fn: "register_verifier",
    signer: "admin",
    args: [
      new Address(params.admin).toScVal(),
      new Address(params.verifier).toScVal(),
      xdr.ScVal.scvBool(params.permitted),
    ],
  });
  return { hash: result.hash, status: result.status };
}

/** Whitelist verifier via admin env key when not already registered. */
export async function ensurePassportVerifierWhitelisted(
  verifier: string,
): Promise<{ newlyRegistered: boolean; txHash?: string }> {
  if (await isPassportVerifierRegistered(verifier)) {
    return { newlyRegistered: false };
  }
  if (!hasAdminSigningKey()) {
    throw new Error(
      `Verifier ${verifier} is not registered and VITE_DEPLOYER_SECRET_KEY is not set for auto-whitelist.`,
    );
  }
  const admin = resolveAdminAddress();
  const result = await registerPassportVerifier({
    admin,
    verifier,
    permitted: true,
  });
  return { newlyRegistered: true, txHash: result.hash };
}

export async function verifyPassportCredential(params: {
  patient: string;
  verifier: string;
  circuitId: number;
  publicInputHex: string[];
  proof: Uint8Array;
  ttlLedgers: number;
}): Promise<InvokeResult> {
  const result = await sendContractInvoke({
    source: params.patient,
    contractId: passportRegistryId(),
    fn: "verify_credential",
    signer: "freighter",
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
  return {
    hash: result.hash,
    status: result.status,
    credentialId: scValToU64(result.returnValue),
  };
}

export async function isPassportVerifierRegistered(
  verifier: string,
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
        function: "is_verifier_registered",
        args: [new Address(verifier).toScVal()],
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

/** Map opaque Soroban traps to actionable passport credential errors. */
export function explainPassportCredentialError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("unreachablecodereached") &&
    lower.includes("verify_credential")
  ) {
    return (
      "Verifier is not registered on the passport registry (or the proof failed verification). " +
      "Set VITE_DEPLOYER_SECRET_KEY so verifiers are auto-whitelisted, then try again."
    );
  }
  if (lower.includes("verifier not registered")) {
    return "Verifier is not registered on-chain. Set VITE_DEPLOYER_SECRET_KEY for automatic whitelist.";
  }
  if (lower.includes("credential proof invalid")) {
    return "ZK proof did not verify on-chain. Refresh the page, re-add passport leaves if needed, and try again.";
  }
  return raw;
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
