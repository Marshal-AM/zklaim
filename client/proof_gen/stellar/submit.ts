import { rpc, type Transaction } from "@stellar/stellar-sdk";
import {
  logSimulation,
  logSorobanDebug,
  logSorobanTx,
  type SorobanDebugSink,
} from "./sorobanDebug.js";
import {
  decodeSubmitErrorXdr,
  isSorobanMetadataExpiredError,
} from "./errors.js";

export interface SubmitClaimParams {
  rpcUrl: string;
  /** Horizon base URL for tx confirmation polling (avoids SDK TransactionMeta parse errors on P23). */
  horizonUrl?: string;
  /**
   * Fresh simulate → Freighter sign per attempt.
   * Must rebuild unsigned tx and re-simulate each call (no cached prepared tx).
   */
  signTransaction: () => Promise<Transaction>;
  /** Extremely detailed Soroban diagnostics (UI + console). */
  debug?: SorobanDebugSink;
  /** Called before a retry when Soroban metadata expired (user must re-approve). */
  onRetry?: (attempt: number) => void;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
  /** Re-sign + re-submit attempts when txSorobanInvalid (default 3). */
  maxSubmitRetries?: number;
}

export interface SubmitClaimResult {
  hash: string;
  status: string;
  result?: rpc.Api.GetTransactionResponse;
}

const DEFAULT_HORIZON_TESTNET = "https://horizon-testnet.stellar.org";

async function pollHorizonTransaction(
  hash: string,
  horizonUrl: string,
): Promise<"SUCCESS" | "FAILED" | "NOT_FOUND"> {
  const res = await fetch(`${horizonUrl}/transactions/${hash}`);
  if (res.status === 404) return "NOT_FOUND";
  if (!res.ok) return "NOT_FOUND";
  const data = (await res.json()) as { successful?: boolean };
  if (data.successful === true) return "SUCCESS";
  if (data.successful === false) return "FAILED";
  return "NOT_FOUND";
}

export async function submitClaim(
  params: SubmitClaimParams,
): Promise<SubmitClaimResult> {
  const server = new rpc.Server(params.rpcUrl);
  const maxSubmitRetries = params.maxSubmitRetries ?? 3;
  const pollInterval = params.pollIntervalMs ?? 1000;
  const maxPollAttempts = params.maxPollAttempts ?? 60;
  const debug = params.debug;
  const horizonUrl = params.horizonUrl ?? DEFAULT_HORIZON_TESTNET;

  let lastError: Error | undefined;

  for (let submitAttempt = 0; submitAttempt < maxSubmitRetries; submitAttempt++) {
    if (submitAttempt > 0) {
      params.onRetry?.(submitAttempt);
      logSorobanDebug(debug, "warn", "submit retry", { submitAttempt });
    }

    const signed = await params.signTransaction();
    const signedSnap = logSorobanTx(debug, signed, "pre-sendTransaction", {
      attempt: submitAttempt,
    });

    if (signedSnap.problems.length > 0) {
      logSorobanDebug(debug, "warn", "problems detected before send", {
        submitAttempt,
        problems: signedSnap.problems,
      });
    }

    // Submit immediately — no RPC calls between sign and send.
    // If available, send the exact Freighter XDR payload to avoid any SDK
    // re-serialization drift against newer protocol fields.
    const rawSignedXdr = (signed as Transaction & { __signedXdr?: string }).__signedXdr;
    const sent = await server.sendTransaction(
      rawSignedXdr
        ? ({ toXDR: () => rawSignedXdr } as unknown as Transaction)
        : signed,
    );

    logSorobanDebug(debug, "info", "sendTransaction response", {
      submitAttempt,
      status: sent.status,
      hash: sent.hash,
      errorResultXdr:
        sent.status === "ERROR"
          ? sent.errorResult?.toXDR("base64")
          : undefined,
    });

    if (sent.status === "ERROR") {
      const errorXdr = sent.errorResult?.toXDR("base64");
      const detail = decodeSubmitErrorXdr(errorXdr);
      lastError = new Error(`sendTransaction failed: ${detail}`);

      // Diagnose opaque txSorobanInvalid by re-simulating the exact signed tx.
      // This runs only after sendTransaction already failed.
      try {
        const postErrorSim = await server.simulateTransaction(signed);
        logSimulation(debug, postErrorSim, "post-send-error-sim");
        if (rpc.Api.isSimulationError(postErrorSim)) {
          logSorobanDebug(debug, "error", "post-send simulation error detail", {
            submitAttempt,
            error: postErrorSim.error,
            latestLedger: postErrorSim.latestLedger,
          });
        }
      } catch (simErr) {
        logSorobanDebug(debug, "warn", "post-send simulation threw", {
          submitAttempt,
          message: simErr instanceof Error ? simErr.message : String(simErr),
        });
      }

      logSorobanDebug(debug, "error", "sendTransaction ERROR", {
        submitAttempt,
        detail,
        errorXdr,
        signedSnapshot: signedSnap,
      });

      if (
        isSorobanMetadataExpiredError(detail) &&
        submitAttempt < maxSubmitRetries - 1
      ) {
        continue;
      }
      throw lastError;
    }

    const hash = sent.hash;

    for (let i = 0; i < maxPollAttempts; i++) {
      const horizonStatus = await pollHorizonTransaction(hash, horizonUrl);
      if (horizonStatus !== "NOT_FOUND") {
        logSorobanDebug(debug, "info", "horizon poll final", {
          hash,
          status: horizonStatus,
          submitAttempt,
        });
        return {
          hash,
          status: horizonStatus,
        };
      }
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new Error(`Transaction ${hash} not confirmed after polling`);
  }

  throw lastError ?? new Error("submitClaim failed after retries");
}
