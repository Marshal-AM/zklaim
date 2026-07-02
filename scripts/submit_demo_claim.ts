/**
 * Prove demo claim and optionally submit to testnet.
 * Uses PATIENT_SECRET_KEY from .env — not stellar CLI identities.
 *
 * Usage:
 *   npm run test:proof-gen
 *   npx tsx scripts/submit_demo_claim.ts [--simulate-only]
 */
import { Keypair, Networks } from "@stellar/stellar-sdk";
import { generateClaimProofs, buildClaimTransaction } from "@zklaim/proof-gen";
import { ensureNodeProofGenInitialized } from "@zklaim/proof-gen/nodeInit";
import { loadDemoClaimData } from "@zklaim/proof-gen/demo";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadDotEnv,
  loadKeypairFromEnv,
  resolvePublicKey,
} from "./lib/envWallet.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  ensureNodeProofGenInitialized();
  const simulateOnly = process.argv.includes("--simulate-only");
  const env = loadDotEnv(ROOT);
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
  const proofPkg = await generateClaimProofs(claim, {
    useWorkers: false,
    onCircuitComplete: (circuit, result) => {
      console.log(
        `  circuit ${circuit}: proof=${result.proof.length}B public_inputs=${result.publicInputs.length}`,
      );
    },
  });
  console.log("  OK: four proofs generated");

  const patient = loadKeypairFromEnv(env, "patient");
  const patientPub =
    patient?.publicKey() ?? resolvePublicKey(env, "patient");

  if (!patientPub) {
    throw new Error(
      "Set PATIENT_SECRET_KEY or PATIENT_PUBLIC_KEY in .env (no stellar CLI identity fallback)",
    );
  }

  console.log(`=== Building submit_claim for ${patientPub} ===`);
  const tx = await buildClaimTransaction({
    proofPackage: proofPkg,
    patientPublicKey: patientPub,
    escrowContractId: escrowId,
    rpcUrl,
    networkPassphrase,
  });
  console.log("  OK: transaction built");

  if (simulateOnly) {
    const { rpc } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(rpcUrl);
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(sim)) {
      throw new Error(`Simulation failed: ${JSON.stringify(sim.error)}`);
    }
    console.log("=== --simulate-only: simulation OK ===");
    console.log("  minResourceFee:", sim.minResourceFee);
    return;
  }

  if (!patient) {
    throw new Error(
      "PATIENT_SECRET_KEY required for live submit (public key alone is simulate-only)",
    );
  }

  tx.sign(patient);
  const signedXdr = tx.toXDR();
  console.log("  OK: signed via PATIENT_SECRET_KEY from .env");

  const { rpc, TransactionBuilder } = await import("@stellar/stellar-sdk");
  const signed = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const server = new rpc.Server(rpcUrl);
  const sent = await server.sendTransaction(signed);
  console.log("  submit status:", sent.status, sent.hash);

  if (sent.status === "ERROR") {
    throw new Error(
      `sendTransaction failed: ${JSON.stringify(sent.errorResult)}`,
    );
  }

  for (let i = 0; i < 60; i++) {
    const result = await server.getTransaction(sent.hash);
    if (result.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      console.log("  ledger status:", result.status);
      if (result.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed on ledger: ${sent.hash}`);
      }
      console.log("=== submit_claim succeeded ===");
      console.log("  tx:", sent.hash);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Transaction ${sent.hash} not confirmed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
