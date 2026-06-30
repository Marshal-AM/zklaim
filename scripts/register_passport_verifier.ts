/**
 * Register a passport verifier using DEPLOYER_SECRET_KEY from .env (no Freighter).
 *
 * Usage:
 *   npx tsx scripts/register_passport_verifier.ts [VERIFIER_G_ADDRESS]
 *
 * Defaults verifier to INSURER_FUND_ADDRESS / DEPLOYER_PUBLIC_KEY.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  Address,
  BASE_FEE,
  Keypair,
  Networks,
  Operation,
  rpc,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  loadDotEnv,
  loadKeypairFromEnv,
  resolvePublicKey,
} from "./lib/envWallet.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const env = loadDotEnv(ROOT);
  const adminKp = loadKeypairFromEnv(env, "admin");
  if (!adminKp) {
    throw new Error(
      "Set DEPLOYER_SECRET_KEY (or ADMIN_SECRET_KEY / INSURER_SECRET_KEY) in .env",
    );
  }

  const passportId = env.PASSPORT_REGISTRY_CONTRACT_ID ?? env.VITE_PASSPORT_REGISTRY_CONTRACT_ID;
  if (!passportId) {
    throw new Error("PASSPORT_REGISTRY_CONTRACT_ID missing in .env");
  }

  const verifier =
    process.argv[2]?.trim() ??
    resolvePublicKey(env, "admin") ??
    adminKp.publicKey();

  const rpcUrl =
    env.STELLAR_RPC_URL ??
    env.VITE_STELLAR_RPC_URL ??
    "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    env.STELLAR_NETWORK_PASSPHRASE ??
    env.VITE_STELLAR_NETWORK_PASSPHRASE ??
    Networks.TESTNET;

  const admin = adminKp.publicKey();
  console.log("=== Register passport verifier ===");
  console.log("  admin:   ", admin);
  console.log("  verifier:", verifier);
  console.log("  contract:", passportId);

  const server = new rpc.Server(rpcUrl);
  const account = await server.getAccount(admin);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: passportId,
        function: "register_verifier",
        args: [
          new Address(admin).toScVal(),
          new Address(verifier).toScVal(),
          xdr.ScVal.scvBool(true),
        ],
      }),
    )
    .setTimeout(300)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(adminKp);
  const sent = await server.sendTransaction(prepared);
  if (sent.status === "ERROR") {
    throw new Error(`Transaction failed: ${sent.hash}`);
  }
  console.log("  tx:", sent.hash);

  for (let i = 0; i < 30; i++) {
    const result = await server.getTransaction(sent.hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log("  status:", result.status);
      if (result.status !== rpc.Api.GetTransactionStatus.SUCCESS) {
        process.exit(1);
      }
      console.log("=== Verifier registered ===");
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("  status: PENDING (poll manually)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
