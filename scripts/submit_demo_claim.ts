/**
 * Prove demo claim and optionally submit to testnet.
 * Usage (WSL):
 *   npm run build:trees
 *   npm run test:proof-gen
 *   npx tsx scripts/submit_demo_claim.ts [--simulate-only]
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import {
  generateClaimProofs,
  buildClaimTransaction,
  loadDemoClaimData,
} from "@zklaim/proof-gen";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

function loadEnv(): Record<string, string> {
  const envPath = join(ROOT, ".env");
  const out: Record<string, string> = {};
  if (!existsSync(envPath)) return out;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

async function main() {
  const simulateOnly = process.argv.includes("--simulate-only");
  const env = loadEnv();
  const rpcUrl =
    env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org";
  const networkPassphrase =
    env.STELLAR_NETWORK_PASSPHRASE ?? Networks.TESTNET;
  const escrowId = env.CLAIM_ESCROW_CONTRACT_ID;
  if (!escrowId) {
    throw new Error("CLAIM_ESCROW_CONTRACT_ID missing in .env");
  }

  console.log("=== Generating proofs (demo claim) ===");
  const claim = await loadDemoClaimData();
  const proofPkg = await generateClaimProofs(claim, { useWorkers: false });
  console.log("  OK: four proofs generated");

  const patientSecret = env.PATIENT_SECRET_KEY;
  if (!patientSecret) {
    console.log("PATIENT_SECRET_KEY not set — proofs only, skipping tx");
    return;
  }

  const patient = Keypair.fromSecret(patientSecret);
  console.log(`=== Building submit_claim for ${patient.publicKey()} ===`);
  const tx = await buildClaimTransaction({
    proofPackage: proofPkg,
    patientPublicKey: patient.publicKey(),
    escrowContractId: escrowId,
    rpcUrl,
    networkPassphrase,
  });
  console.log("  OK: transaction built");

  if (simulateOnly) {
    console.log("=== --simulate-only: not submitting ===");
    return;
  }

  tx.sign(patient);
  const { SorobanRpc } = await import("@stellar/stellar-sdk");
  const server = new SorobanRpc.Server(rpcUrl);
  const sent = await server.sendTransaction(tx);
  console.log("  submit status:", sent.status, sent.hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
