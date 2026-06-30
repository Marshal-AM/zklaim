import { readFileSync } from "node:fs";
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
const patient =
  process.argv[2] ??
  "GCGZCJPURSJPWVDWXIBCT4GHRYPOUZ2CDS5SW7GR4TNZCDS5IOHNMLNO";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(join(ROOT, ".env"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]!] = m[2]!.replace(/^"|"$/g, "");
  }
  return out;
}

async function main() {
  const env = loadEnv();
  const contract = env.VITE_PASSPORT_REGISTRY_CONTRACT_ID!;
  const source = env.DEPLOYER_PUBLIC_KEY!;
  const server = new rpc.Server(env.VITE_STELLAR_RPC_URL!);
  const account = await server.getAccount(source);

  async function sim(fn: string, args: xdr.ScVal[]) {
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: env.VITE_STELLAR_NETWORK_PASSPHRASE!,
    })
      .addOperation(
        Operation.invokeContractFunction({ contract, function: fn, args }),
      )
      .setTimeout(30)
      .build();
    const s = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(s)) throw new Error(s.error);
    return s.result?.retval!;
  }

  const rootVal = await sim("get_root", [new Address(patient).toScVal()]);
  const countVal = await sim("get_leaf_count", [new Address(patient).toScVal()]);
  const count = countVal.u32();
  console.log("patient:", patient);
  console.log("leaf_count:", count);
  console.log("root:", "0x" + Buffer.from(rootVal.bytes()).toString("hex"));

  for (let i = 0; i < count; i++) {
    const pathVal = await sim("get_merkle_path", [
      new Address(patient).toScVal(),
      xdr.ScVal.scvU32(i),
    ]);
    const vec = pathVal.vec() ?? [];
    console.log(`\nmerkle_path[${i}]:`);
    vec.forEach((v, j) =>
      console.log(`  [${j}] 0x${Buffer.from(v.bytes()).toString("hex")}`),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
