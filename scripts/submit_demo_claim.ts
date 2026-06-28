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
import { execFileSync } from "node:child_process";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import { generateClaimProofs, buildClaimTransaction } from "@zklaim/proof-gen";
import { loadDemoClaimData } from "@zklaim/proof-gen/demo";

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

function loadPatientKeypair(
  env: Record<string, string>,
  simulateOnly: boolean,
): Keypair | null {
  const secret = loadPatientSecret(env);
  if (secret) return Keypair.fromSecret(secret);

  const patientPub =
    process.env.PATIENT_PUBLIC_KEY ??
    env.PATIENT_PUBLIC_KEY ??
    env.DEPLOYER_PUBLIC_KEY;
  if (simulateOnly && patientPub) {
    // Simulation only needs a funded account envelope; key not required.
    return Keypair.fromPublicKey(patientPub);
  }
  return null;
}

function loadPatientSecret(env: Record<string, string>): string | undefined {
  if (process.env.PATIENT_SECRET_KEY) return process.env.PATIENT_SECRET_KEY;
  if (env.PATIENT_SECRET_KEY) return env.PATIENT_SECRET_KEY;

  const identity =
    process.env.PATIENT_IDENTITY ?? env.PATIENT_IDENTITY ?? "zklaim-patient";
  const candidates = [
    join(ROOT, ".stellar", "identity", `${identity}.toml`),
    join(process.env.HOME ?? "", ".config", "stellar", "identity", `${identity}.toml`),
  ];
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const body = readFileSync(path, "utf8");
    const secretMatch = body.match(/secret_key\s*=\s*"([^"]+)"/);
    if (secretMatch) return secretMatch[1];
  }

  try {
    return execFileSync("stellar", ["keys", "secret", identity], {
      encoding: "utf8",
      cwd: ROOT,
    }).trim();
  } catch {
    return undefined;
  }
}

function signWithStellarCli(unsignedXdr: string, identity: string): string {
  return execFileSync(
    "stellar",
    ["tx", "sign", "--source-account", identity],
    { input: unsignedXdr, encoding: "utf8" },
  ).trim();
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

  const patient = loadPatientKeypair(env, simulateOnly);
  const patientIdentity =
    process.env.PATIENT_IDENTITY ?? env.PATIENT_IDENTITY ?? "zklaim-patient";
  let patientPub = patient?.publicKey();
  if (!patientPub) {
    try {
      patientPub = execFileSync(
        "stellar",
        ["keys", "address", patientIdentity],
        { encoding: "utf8", cwd: ROOT },
      ).trim();
    } catch {
      patientPub = undefined;
    }
  }
  if (!patientPub) {
    console.log(
      "Set PATIENT_SECRET_KEY, PATIENT_IDENTITY, or DEPLOYER_PUBLIC_KEY (simulate-only) — skipping tx",
    );
    return;
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

  let signedXdr: string;
  try {
    signedXdr = signWithStellarCli(tx.toXDR(), patientIdentity);
    console.log("  OK: signed via stellar CLI");
  } catch (err) {
    if (!patient) {
      throw err;
    }
    tx.sign(patient);
    signedXdr = tx.toXDR();
    console.log("  OK: signed via Keypair");
  }

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
