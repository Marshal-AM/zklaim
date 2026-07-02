import {
  Address,
  BASE_FEE,
  Operation,
  rpc,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./lib/envWallet.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const patient =
  process.argv[2] ??
  "GAYUOR5IL7Q6TZDH7D3YWTDZOZ6B3YACUGPAQ5VH75XKAGSRYSVJC4TG";

async function main() {
  const env = loadDotEnv(ROOT);
  const server = new rpc.Server(env.STELLAR_RPC_URL!);
  const account = await server.getAccount(env.INSURER_FUND_ADDRESS!);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: env.STELLAR_NETWORK_PASSPHRASE!,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: env.DEDUCTIBLE_TRACKER_CONTRACT_ID!,
        function: "get_accumulator",
        args: [new Address(patient).toScVal()],
      }),
    )
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    throw new Error(sim.error);
  }
  const root = Buffer.from(sim.result!.retval.bytes()).toString("hex");
  console.log("patient:", patient);
  console.log("on-chain accumulator:", "0x" + root);
  console.log("genesis (zero field):", /^0+$/.test(root));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
