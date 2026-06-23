import {
  Address,
  BASE_FEE,
  Operation,
  TransactionBuilder,
  rpc,
  type Transaction,
} from "@stellar/stellar-sdk";
import type { Account } from "@stellar/stellar-sdk";
import type { ProofPackage } from "../inputs.js";
import { buildClaimPackageOnChain, claimPackageToScVal } from "./encoding.js";

export interface BuildClaimTransactionParams {
  proofPackage: ProofPackage;
  patientPublicKey: string;
  escrowContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export type ClaimTransactionPreparer = () => Promise<Transaction>;

function buildUnsignedClaimTransaction(
  account: Account,
  params: BuildClaimTransactionParams,
): Transaction {
  const claimPkg = buildClaimPackageOnChain(params.proofPackage);
  const claimScVal = claimPackageToScVal(claimPkg);

  return new TransactionBuilder(account, {
    // Must be network base fee (100). assembleTransaction adds minResourceFee;
    // protocol requires tx.fee - baseFee === sorobanData.resourceFee.
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
        source: params.patientPublicKey,
      }),
    )
    .setTimeout(30)
    .build();
}

export async function prepareClaimTransaction(
  server: rpc.Server,
  unsigned: Transaction,
): Promise<Transaction> {
  return server.prepareTransaction(unsigned);
}

/** Fetch fresh sequence + build unsigned invoke (no simulation). */
export function createUnsignedClaimPreparer(
  params: BuildClaimTransactionParams,
): ClaimTransactionPreparer {
  const server = new rpc.Server(params.rpcUrl);
  return async () => {
    const account = await server.getAccount(params.patientPublicKey);
    return buildUnsignedClaimTransaction(account, params);
  };
}

/** @deprecated Use createUnsignedClaimPreparer + prepare in sign step. */
export function createClaimTransactionPreparer(
  params: BuildClaimTransactionParams,
): ClaimTransactionPreparer {
  const server = new rpc.Server(params.rpcUrl);
  return async () => {
    const account = await server.getAccount(params.patientPublicKey);
    const unsigned = buildUnsignedClaimTransaction(account, params);
    return prepareClaimTransaction(server, unsigned);
  };
}

export async function buildClaimTransaction(
  params: BuildClaimTransactionParams,
): Promise<Transaction> {
  return createClaimTransactionPreparer(params)();
}
