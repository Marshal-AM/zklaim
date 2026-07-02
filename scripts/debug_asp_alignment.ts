import { rpc } from "@stellar/stellar-sdk";
import { generateClaimProofs } from "@zklaim/proof-gen";
import { ensureNodeProofGenInitialized } from "@zklaim/proof-gen/nodeInit";
import { loadDemoClaimData } from "@zklaim/proof-gen/demo";
import { buildClaimTransaction } from "@zklaim/proof-gen";
import { fieldToHex } from "@zklaim/scripts";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadDotEnv } from "./lib/envWallet.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  ensureNodeProofGenInitialized();
  const env = loadDotEnv(ROOT);
  const patient =
    process.env.PATIENT_PUBLIC_KEY ??
    env.PATIENT_PUBLIC_KEY ??
    env.INSURER_FUND_ADDRESS;
  if (!patient) {
    throw new Error("Set PATIENT_PUBLIC_KEY or INSURER_FUND_ADDRESS");
  }

  const claim = await loadDemoClaimData();
  claim.insurer =
    env.INSURER_FUND_ADDRESS ?? env.DEPLOYER_PUBLIC_KEY ?? claim.insurer;
  const pkg = await generateClaimProofs(claim, { useWorkers: false });
  const proofAspRoot = fieldToHex(pkg.doctorResult.publicInputs[0]);
  const artifactAspRoot = fieldToHex(claim.doctor_attestation.asp_merkle_root);

  console.log("artifact asp_tree root:     ", artifactAspRoot);
  console.log("proof doctor_inputs[0]:     ", proofAspRoot);

  const server = new rpc.Server(
    env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  );
  const { Operation, TransactionBuilder, BASE_FEE, Address } = await import(
    "@stellar/stellar-sdk"
  );
  const admin = env.INSURER_FUND_ADDRESS ?? env.DEPLOYER_PUBLIC_KEY;
  const account = await server.getAccount(admin!);
  const aspTx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase:
      env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: env.ASP_MEMBER_CONTRACT_ID!,
        function: "get_root",
        args: [],
      }),
    )
    .setTimeout(30)
    .build();
  const aspSim = await server.simulateTransaction(aspTx);
  if (rpc.Api.isSimulationError(aspSim)) {
    throw new Error(`ASP get_root failed: ${aspSim.error}`);
  }
  const onChainAsp = Buffer.from(aspSim.result!.retval.bytes()).toString("hex");
  console.log("on-chain asp (env id):      ", "0x" + onChainAsp);
  console.log(
    "proof vs on-chain match:    ",
    proofAspRoot.replace(/^0x/i, "").toLowerCase() === onChainAsp.toLowerCase(),
  );

  const tx = await buildClaimTransaction({
    proofPackage: pkg,
    patientPublicKey: patient,
    escrowContractId: env.CLAIM_ESCROW_CONTRACT_ID!,
    rpcUrl: env.STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
    networkPassphrase:
      env.STELLAR_NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015",
  });
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) {
    console.log("\nsubmit_claim simulation FAILED:");
    console.log(sim.error);
  } else {
    console.log("\nsubmit_claim simulation OK");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
