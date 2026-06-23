import { signAuthEntry } from "@stellar/freighter-api";
import {
  authorizeEntry,
  Operation,
  rpc,
  TransactionBuilder,
  type Transaction,
} from "@stellar/stellar-sdk";
import { freighterLog } from "./freighterDebug";

function isSorobanPrepared(tx: Transaction): boolean {
  const op = tx.operations[0];
  if (op?.type !== "invokeHostFunction") return false;
  const extSwitch = tx.toEnvelope().v1()?.tx()?.ext()?.switch();
  const extValue =
    typeof extSwitch === "number"
      ? extSwitch
      : (extSwitch as { value?: number } | undefined)?.value;
  // 0 = void; 1 = sorobanTxData
  return extValue !== undefined && extValue !== 0;
}

function assertHasSorobanData(tx: Transaction, stage: string): void {
  if (!isSorobanPrepared(tx)) {
    const extSwitch = tx.toEnvelope().v1()?.tx()?.ext()?.switch();
    throw new Error(
      `Transaction missing Soroban metadata after ${stage} (ext=${JSON.stringify(extSwitch)}). Update Freighter and retry.`,
    );
  }
}

/**
 * Single simulate+assemble immediately before Freighter.
 * Signs Soroban auth entries when simulation requires them.
 */
export async function prepareSorobanTransaction(
  unsigned: Transaction,
  rpcUrl: string,
  networkPassphrase: string,
  signerAddress: string,
): Promise<Transaction> {
  const server = new rpc.Server(rpcUrl);
  const simulated = await server.simulateTransaction(unsigned);
  if (rpc.Api.isSimulationError(simulated)) {
    throw new Error(
      `Simulation failed: ${JSON.stringify(simulated.error ?? simulated)}`,
    );
  }

  let txForAssemble = unsigned;

  if (
    rpc.Api.isSimulationSuccess(simulated) &&
    simulated.result?.auth &&
    simulated.result.auth.length > 0
  ) {
    freighterLog("signing Soroban auth entries", {
      count: simulated.result.auth.length,
      signer: signerAddress,
    });
    const validUntil = simulated.latestLedger + 100;
    const signedAuth = await Promise.all(
      simulated.result.auth.map((entry) =>
        authorizeEntry(
          entry,
          async (preimage) => {
            const preimageXdr = preimage.toXDR("base64");
            const signed = await signAuthEntry(preimageXdr, {
              accountToSign: signerAddress,
            });
            return Buffer.from(signed, "base64");
          },
          validUntil,
          networkPassphrase,
        ),
      ),
    );

    const op = unsigned.operations[0];
    if (op.type !== "invokeHostFunction") {
      throw new Error("Expected Soroban invokeHostFunction operation");
    }

    txForAssemble = TransactionBuilder.cloneFrom(unsigned, {
      fee: unsigned.fee,
      networkPassphrase,
    })
      .clearOperations()
      .addOperation(
        Operation.invokeHostFunction({
          source: op.source,
          func: op.func,
          auth: signedAuth,
        }),
      )
      .build();
  }

  const prepared = rpc.assembleTransaction(txForAssemble, simulated).build();
  assertHasSorobanData(prepared, "prepare");
  return prepared;
}

export function assertSorobanTransactionReady(tx: Transaction): void {
  assertHasSorobanData(tx, "sign");
}
