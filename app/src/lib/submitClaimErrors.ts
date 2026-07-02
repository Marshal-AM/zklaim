const REDEPLOY_HINT =
  "Run npm run redeploy:asp-escrow, restart the dev server, then retry.";

const TREE_SYNC_HINT =
  "Run npm run build:trees && npm run redeploy:asp-escrow — then restart npm run dev.";

export interface SubmitClaimErrorInfo {
  toast: string;
  invalidateAlignment: boolean;
}

/** Map Soroban / Freighter failures to actionable patient-facing messages. */
export function explainSubmitClaimError(message: string): SubmitClaimErrorInfo {
  const msg = message;

  if (msg.includes("Merkle trees are out of sync")) {
    return { toast: msg, invalidateAlignment: true };
  }

  if (msg.includes("asp root mismatch")) {
    return {
      toast: `Doctor registry (ASP) on-chain does not match your proofs. ${REDEPLOY_HINT}`,
      invalidateAlignment: true,
    };
  }

  if (msg.includes("coverage root mismatch")) {
    return {
      toast: `Policy coverage root on-chain does not match your proofs. ${TREE_SYNC_HINT}`,
      invalidateAlignment: true,
    };
  }

  if (msg.includes("bounds hash mismatch")) {
    return {
      toast: `Policy bounds on-chain do not match your proofs. ${TREE_SYNC_HINT}`,
      invalidateAlignment: true,
    };
  }

  if (
    msg.includes("billing pattern flagged as fraud") ||
    msg.includes("verify_non_membership")
  ) {
    return {
      toast: `Fraud blacklist on-chain does not match your proofs. ${REDEPLOY_HINT}`,
      invalidateAlignment: true,
    };
  }

  if (
    msg.includes("previous accumulator mismatch") ||
    (msg.includes("update_accumulator") &&
      msg.includes("previous accumulator"))
  ) {
    return {
      toast:
        "Deductible accumulator on-chain does not match this claim. This wallet already has a prior settlement — submit with the same browser identity, or onboard a fresh Freighter wallet for another demo claim.",
      invalidateAlignment: false,
    };
  }

  if (
    msg.includes("accumulator proof invalid") ||
    (msg.includes("update_accumulator") && msg.includes("InvalidAction"))
  ) {
    return {
      toast:
        "Deductible accumulator proof rejected on-chain. If you already submitted a claim with this wallet, use a fresh wallet or recover the prior claim secrets from this browser.",
      invalidateAlignment: false,
    };
  }

  if (msg.includes("proof verification failed")) {
    return {
      toast:
        "A ZK proof was rejected by the on-chain verifier. Retry once; if it persists, run npm run init:vks after reproving circuits.",
      invalidateAlignment: false,
    };
  }

  if (msg.includes("policy expired")) {
    return {
      toast: "Insurer policy is inactive on-chain. Re-register the demo policy in Admin.",
      invalidateAlignment: false,
    };
  }

  if (msg.includes("nullifier already spent")) {
    return {
      toast: "This claim was already submitted (nullifier spent).",
      invalidateAlignment: false,
    };
  }

  if (
    msg.includes("txSorobanInvalid") ||
    msg.includes("Soroban metadata expired")
  ) {
    return {
      toast: `Soroban transaction rejected at submit. Retry immediately. If this persists, ${REDEPLOY_HINT}`,
      invalidateAlignment: false,
    };
  }

  if (msg.includes("Freighter changed the transaction body")) {
    return {
      toast:
        "Freighter network mismatch. Switch Freighter to Testnet (Settings → Network), refresh, and retry.",
      invalidateAlignment: false,
    };
  }

  if (msg.includes("missing Soroban metadata")) {
    return {
      toast:
        "Freighter returned a transaction without Soroban data. Update Freighter to the latest version and retry.",
      invalidateAlignment: false,
    };
  }

  if (
    msg.includes("Error(Auth") &&
    (msg.includes("transfer") || msg.includes("authorization not tied"))
  ) {
    return {
      toast: `Insurer USDC escrow is not funded or claim escrow is outdated. ${REDEPLOY_HINT}`,
      invalidateAlignment: false,
    };
  }

  if (msg.includes("Simulation failed") || msg.includes("Auth validation failed")) {
    return {
      toast: msg.length > 240 ? `${msg.slice(0, 240)}…` : msg,
      invalidateAlignment: false,
    };
  }

  return { toast: msg, invalidateAlignment: false };
}
