/**
 * Simulate ultrahonk verify(circuit_id=4) on testnet with local bb artifacts.
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Address,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BB = join(ROOT, "circuits/target/bb/category_nonmembership");

function loadEnv(): Record<string, string> {
  const path = join(ROOT, ".env");
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

function chunkPublicInputs(buf: Buffer): Buffer[] {
  const fields: Buffer[] = [];
  for (let i = 0; i < buf.length; i += 32) {
    fields.push(buf.subarray(i, i + 32));
  }
  return fields;
}

async function main() {
  const env = loadEnv();
  const verifierId = env.VERIFIER_CONTRACT_ID;
  const source = env.DEPLOYER_PUBLIC_KEY ?? env.INSURER_FUND_ADDRESS;
  const rpcUrl = env.VITE_STELLAR_RPC_URL ?? env.STELLAR_RPC_URL;
  const passphrase =
    env.VITE_STELLAR_NETWORK_PASSPHRASE ?? env.STELLAR_NETWORK_PASSPHRASE;

  if (!verifierId || !source || !rpcUrl || !passphrase) {
    throw new Error("Missing VERIFIER_CONTRACT_ID / RPC / passphrase in .env");
  }

  const proof = readFileSync(join(BB, "proof"));
  const publicInputs = readFileSync(join(BB, "public_inputs"));
  const fields = chunkPublicInputs(publicInputs);

  console.log("proof bytes:", proof.length);
  console.log("public input fields:", fields.length);
  fields.forEach((f, i) => console.log(`  PI[${i}]:`, "0x" + f.toString("hex")));

  const server = new rpc.Server(rpcUrl);
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: passphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: verifierId,
        function: "verify_fields",
        args: [
          xdr.ScVal.scvU32(4),
          xdr.ScVal.scvVec(
            fields.map((f) =>
              xdr.ScVal.scvBytes(f as unknown as Buffer),
            ),
          ),
          xdr.ScVal.scvBytes(proof as unknown as Buffer),
        ],
      }),
    )
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.error("SIMULATION ERROR:", sim.error);
    if (sim.events) console.error("events:", JSON.stringify(sim.events, null, 2));
    process.exit(1);
  }
  const ok = sim.result?.retval?.b();
  console.log("verify_fields result:", ok);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
