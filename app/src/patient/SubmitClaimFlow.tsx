import { useCallback, useMemo, useState } from "react";
import {
  generateClaimProofs,
  createUnsignedClaimPreparer,
  submitClaim,
  type ProofProgressStage,
} from "@zklaim/proof-gen";
import { fieldToHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../components/WalletButton";
import { ProofProgress } from "../components/ProofProgress";
import { ErrorBanner } from "../components/ErrorBanner";
import { SubmitClaimLogPanel } from "../components/SubmitClaimLogPanel";
import { freighterSignTransaction } from "../lib/freighter";
import { prepareSorobanTransaction, assertSorobanTransactionReady } from "../lib/sorobanWallet";
import { markDeliveryClaimed } from "../lib/claimDelivery";
import {
  decryptClaimToken,
  type EncryptedClaimToken,
} from "../lib/claimToken";
import { hydrateClaimFromToken } from "../lib/hydrateClaim";
import { fetchUsdcBalance, formatUsdc } from "../lib/balances";
import {
  formatVisitDate,
  shortClaimId,
  summarizeInboxClaim,
} from "../lib/claimInbox";
import {
  savePatientHistory,
  savePatientIdentity,
  savePatientInbox,
} from "../lib/persistence";
import {
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  resolveDemoPolicyBounds,
} from "../config/demoPolicy";
import { env } from "../config/env";
import {
  createSubmitClaimLogger,
  type SubmitClaimLogEntry,
} from "../lib/submitClaimLog";
import {
  usePatientStore,
  type InboxClaim,
} from "../store/patientStore";

interface SubmitClaimFlowProps {
  claim: InboxClaim;
  onComplete: () => void;
}

const PROOF_STAGE_LABELS: Record<ProofProgressStage, string> = {
  policy: "ZK proof 1/4 — policy validity",
  amount: "ZK proof 2/4 — amount range",
  doctor: "ZK proof 3/4 — doctor attestation",
  accum: "ZK proof 4/4 — deductible accumulator",
  nullifier: "Computing claim nullifier",
};

export function SubmitClaimFlow({ claim, onComplete }: SubmitClaimFlowProps) {
  const identity = usePatientStore((s) => s.identity)!;
  const updateInboxClaim = usePatientStore((s) => s.updateInboxClaim);
  const addHistory = usePatientStore((s) => s.addHistory);
  const updateAccumulator = usePatientStore((s) => s.updateAccumulator);
  const inbox = usePatientStore((s) => s.inbox);
  const history = usePatientStore((s) => s.history);

  const [stage, setStage] = useState<ProofProgressStage | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logEntries, setLogEntries] = useState<SubmitClaimLogEntry[]>([]);
  const [receipt, setReceipt] = useState<{
    nullifier: string;
    txHash: string;
    usdcReceived: number;
  } | null>(null);

  const appendLog = useCallback((entry: SubmitClaimLogEntry) => {
    setLogEntries((prev) => [...prev, entry]);
  }, []);

  const log = useMemo(
    () => createSubmitClaimLogger(appendLog),
    [appendLog],
  );

  const claimSummary = summarizeInboxClaim(claim, identity.box_secret_key);

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    setLogEntries([]);
    log.clear();
    setStartedAt(Date.now());
    updateInboxClaim(claim.id, { status: "pending" });

    log.info("Submit claim started", {
      claimId: claim.id,
      claimShortId: shortClaimId(claim.id),
      claimSummary: claimSummary
        ? {
            amount: claimSummary.amount_label,
            icd_code: claimSummary.icd_code,
            visit_date: claimSummary.visit_date,
            doctor_license_id: claimSummary.doctor_license_id,
          }
        : null,
      deliveryId: claim.deliveryId ?? null,
      receivedAt: claim.receivedAt,
      rpcUrl: env.rpcUrl,
      escrowContractId: env.claimEscrowId(),
    });

    try {
      log.info("Connecting Freighter wallet…");
      const address = await ensureWalletConnected();
      log.success("Wallet connected", { address });

      log.info("Fetching USDC balance (before)…");
      const balanceBefore = await fetchUsdcBalance(address);
      log.success("Balance snapshot (before)", {
        usdc: formatUsdc(balanceBefore),
        raw: balanceBefore,
      });

      log.info("Decrypting claim token with patient box key…");
      const payload = decryptClaimToken(
        claim.token as EncryptedClaimToken,
        identity.box_secret_key,
      );
      log.success("Claim token decrypted", {
        policy_id: payload.policy_id,
        amount_cents: payload.amount_cents,
        visit_date: payload.visit_date,
        icd_code: payload.icd_code,
        doctor_license_id: payload.doctor_license_id,
        doctor_address: payload.doctor_address,
        has_doctor_signature: payload.doctor_signature.length > 0,
        token_policy_floor_cents: payload.policy_floor_cents,
        token_policy_ceiling_cents: payload.policy_ceiling_cents,
      });

      const policyBounds = resolveDemoPolicyBounds(payload);
      if (policyBounds.wasStale) {
        log.warn("Claim token had stale policy bounds — using current demo policy", {
          token_floor_cents: payload.policy_floor_cents,
          token_ceiling_cents: payload.policy_ceiling_cents,
          effective_floor_cents: policyBounds.policy_floor_cents,
          effective_ceiling_cents: policyBounds.policy_ceiling_cents,
        });
      }

      if (payload.amount_cents < DEMO_POLICY_FLOOR_CENTS) {
        throw new Error(
          `Claim amount ${payload.amount_cents}¢ is below demo policy floor ${DEMO_POLICY_FLOOR_CENTS}¢`,
        );
      }
      if (payload.amount_cents > DEMO_POLICY_CEILING_CENTS) {
        throw new Error(
          `Claim amount ${payload.amount_cents}¢ exceeds demo policy ceiling ${DEMO_POLICY_CEILING_CENTS}¢`,
        );
      }

      log.info("Hydrating claim data (trees + WASM circuits)…");
      const claimData = await hydrateClaimFromToken(
        payload,
        identity,
        {
          random_nonce: claim.random_nonce,
          blinding_factor: claim.blinding_factor,
        },
      );
      log.success("Claim data hydrated", {
        policy_floor_cents: claimData.policy_floor_cents,
        policy_ceiling_cents: claimData.policy_ceiling_cents,
        deductible_met_cents: identity.accumulator_met_cents,
        deductible_limit_cents: identity.deductible_limit_cents,
        insurer: claimData.insurer,
      });

      log.info("Generating ZK proofs in Web Workers (~7–10s)…");
      const proofPkg = await generateClaimProofs(claimData, {
        useWorkers: true,
        onProgress: (s) => {
          setStage(s);
          log.info(PROOF_STAGE_LABELS[s] ?? `Proof stage: ${s}`);
        },
      });
      const nullifierHex = fieldToHex(proofPkg.nullifier);
      log.success("All proofs generated", {
        nullifier: nullifierHex,
        claim_hash: fieldToHex(proofPkg.claim_hash),
        payout_amount: proofPkg.payout_amount,
        fraud_proof_present: Boolean(proofPkg.fraud),
      });

      log.info("Requesting Freighter signature (simulate once, then sign)…");
      const getUnsigned = createUnsignedClaimPreparer({
        proofPackage: proofPkg,
        patientPublicKey: address,
        escrowContractId: env.claimEscrowId(),
        rpcUrl: env.rpcUrl,
        networkPassphrase: env.networkPassphrase,
      });

      const result = await submitClaim({
        rpcUrl: env.rpcUrl,
        signTransaction: async () => {
          const unsigned = await getUnsigned();
          log.info("Simulating Soroban transaction…");
          const prepared = await prepareSorobanTransaction(
            unsigned,
            env.rpcUrl,
            env.networkPassphrase,
            address,
          );
          log.success("Simulation OK — approve in Freighter", { fee: prepared.fee });
          const signed = await freighterSignTransaction(prepared);
          assertSorobanTransactionReady(signed);
          log.success("Freighter signed transaction");
          return signed;
        },
      });
      log.info("Transaction broadcast", { hash: result.hash });

      if (result.status === "FAILED") {
        log.error("Ledger rejected transaction", { status: result.status });
        throw new Error("Transaction failed on ledger");
      }
      log.success("Transaction confirmed on ledger", {
        hash: result.hash,
        status: result.status,
      });

      log.info("Fetching USDC balance (after)…");
      const balanceAfter = await fetchUsdcBalance(address);
      const usdcReceived = Math.max(0, balanceAfter - balanceBefore);
      log.success("Payout received", {
        usdc: formatUsdc(usdcReceived),
        balanceBefore: formatUsdc(balanceBefore),
        balanceAfter: formatUsdc(balanceAfter),
      });

      const newMet =
        identity.accumulator_met_cents + payload.amount_cents;
      const updatedIdentity = {
        ...identity,
        accumulator_met_cents: Math.min(
          newMet,
          identity.deductible_limit_cents,
        ),
      };
      usePatientStore.getState().setIdentity(updatedIdentity);
      updateAccumulator(updatedIdentity.accumulator_met_cents);
      await savePatientIdentity(updatedIdentity);
      log.success("Deductible accumulator updated", {
        previous_met_cents: identity.accumulator_met_cents,
        new_met_cents: updatedIdentity.accumulator_met_cents,
      });

      const nextInbox = inbox.map((c) =>
        c.id === claim.id ? { ...c, status: "submitted" as const } : c,
      );
      updateInboxClaim(claim.id, { status: "submitted" });
      await savePatientInbox(nextInbox);
      log.success("Inbox claim marked submitted", { claimId: claim.id });

      const histEntry = {
        nullifier: nullifierHex,
        submittedAt: new Date().toISOString(),
        txHash: result.hash,
      };
      addHistory(histEntry);
      await savePatientHistory([histEntry, ...history]);
      log.success("Claim history saved", histEntry);

      if (claim.deliveryId) {
        log.info("Marking Supabase delivery as claimed…", {
          deliveryId: claim.deliveryId,
        });
        void markDeliveryClaimed(claim.deliveryId)
          .then(() => {
            log.success("Supabase delivery marked claimed");
          })
          .catch((err) => {
            log.warn("Supabase delivery update failed (non-fatal)", err);
          });
      }

      setReceipt({
        nullifier: nullifierHex,
        txHash: result.hash,
        usdcReceived,
      });
      log.success("Submit claim completed successfully");
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submit failed";
      log.error("Submit claim failed", err);
      if (
        msg.includes("asp root mismatch") ||
        (msg.includes("UnreachableCodeReached") &&
          msg.includes("submit_claim") &&
          msg.includes("get_root"))
      ) {
        setError(
          "Doctor registry (ASP) on-chain does not match your proofs. Run npm run redeploy:asp-escrow, restart the dev server, then retry.",
        );
      } else if (
        msg.includes("fraud non-membership") ||
        (msg.includes("verify_non_membership") && msg.includes("false"))
      ) {
        setError(
          "Fraud blacklist on-chain does not match your proofs. Run npm run redeploy:asp-escrow, restart the dev server, then retry.",
        );
      } else if (
        msg.includes("txSorobanInvalid") ||
        msg.includes("Soroban metadata expired")
      ) {
        setError(
          "Soroban transaction rejected at submit. Approve all Freighter prompts (auth + transaction) and retry immediately.",
        );
      } else if (msg.includes("missing Soroban metadata")) {
        setError(
          "Freighter returned a transaction without Soroban data. Update Freighter to the latest version and retry.",
        );
      } else if (
        msg.includes("Error(Auth") &&
        (msg.includes("transfer") || msg.includes("authorization not tied"))
      ) {
        setError(
          "Insurer USDC escrow is not funded or claim escrow is outdated. Run npm run redeploy:asp-escrow, then retry.",
        );
      } else if (msg.includes("Simulation failed") || msg.includes("Provider")) {
        setError("Provider not verified or claim rejected on-chain.");
      } else {
        setError(msg);
      }
      updateInboxClaim(claim.id, { status: "failed" });
      log.warn("Inbox claim marked failed", { claimId: claim.id });
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-6 space-y-3">
          <h3 className="text-lg font-medium text-emerald-300">
            USDC received. Claim settled.
          </h3>
          <p className="text-2xl font-semibold">
            +{formatUsdc(receipt.usdcReceived)}
          </p>
          <p className="text-xs text-slate-400 font-mono break-all">
            Confirmation: {receipt.nullifier}
          </p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-sky-400 hover:underline"
          >
            View on explorer
          </a>
        </div>
        <SubmitClaimLogPanel entries={logEntries} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-900/50 px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Selected claim
        </p>
        <p className="font-medium text-slate-200 mt-1">
          {claimSummary
            ? `${claimSummary.amount_label} · ${claimSummary.icd_code} · ${claimSummary.doctor_license_id}`
            : "Encrypted claim"}
        </p>
        <p className="text-xs text-slate-500 mt-1">
          {claimSummary
            ? `Visit ${formatVisitDate(claimSummary.visit_date)} · `
            : ""}
          {claim.status === "failed" ? "Retry · " : ""}
          ID {shortClaimId(claim.id)}
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      {!busy && !stage && (
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
        >
          Submit Claim
        </button>
      )}
      {(busy || stage) && (
        <ProofProgress currentStage={stage} startedAt={startedAt} />
      )}
      <SubmitClaimLogPanel entries={logEntries} />
    </div>
  );
}
