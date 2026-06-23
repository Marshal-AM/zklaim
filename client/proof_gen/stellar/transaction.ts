import {
  Address,
  Operation,
  TransactionBuilder,
  SorobanRpc,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import type { ProofPackage } from "../inputs.js";
import { buildClaimPackageOnChain, claimPackageToScVal } from "./encoding.js";

export interface BuildClaimTransactionParams {
  proofPackage: ProofPackage;
  patientPublicKey: string;
  escrowContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export async function buildClaimTransaction(
  params: BuildClaimTransactionParams,
) {
  const server = new SorobanRpc.Server(params.rpcUrl);
  const account = await server.getAccount(params.patientPublicKey);
  const claimPkg = buildClaimPackageOnChain(params.proofPackage);
  const claimScVal = claimPackageToScVal(claimPkg);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: params.networkPassphrase,
  })
    .addOperation(
      Operation.invokeContractFunction({
        contract: params.escrowContractId,
        function: "submit_claim",
        args: [
          new Address(params.patientPublicKey).toScVal(),
          claimScVal,
        ],
      }),
    )
    .setTimeout(300)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulated.error ?? simulated)}`,
    );
  }

  return SorobanRpc.assembleTransaction(tx, simulated).build();
}
