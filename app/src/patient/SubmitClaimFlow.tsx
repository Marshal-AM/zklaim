import { useCallback, useMemo, useState } from "react";
import {
  generateClaimProofs,
  createUnsignedClaimPreparer,
  submitClaim,
  type ProofProgressStage,
} from "@zklaim/proof-gen";
import { fieldToHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { ProofProgress } from "../components/ProofProgress";
import { ErrorBanner } from "../components/ErrorBanner";
import { SubmitClaimLogPanel } from "../components/SubmitClaimLogPanel";
import type { SorobanDebugSink } from "@zklaim/proof-gen/stellar/sorobanDebug";
import {
  signSorobanClaimTransaction,
  assertSorobanTransactionReady,
} from "../lib/sorobanWallet";
import { markDeliveryClaimed } from "../lib/claimDelivery";
import {
  decryptClaimToken,
  type EncryptedClaimToken,
  type ClaimTokenPayload,
} from "../lib/claimToken";
import { appendSettlementToPassport } from "../lib/passportAppend";
import { isPassportConfigured } from "../lib/passportContract";
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
    patientAddress: string;
    payload: ClaimTokenPayload;
  } | null>(null);
  const [passportBusy, setPassportBusy] = useState(false);
  const [passportAdded, setPassportAdded] = useState(false);
  const [passportError, setPassportError] = useState<string | null>(null);

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

      log.info(
        "Requesting Freighter signature (fresh simulate → sign → send)…",
      );
      const getUnsigned = createUnsignedClaimPreparer({
        proofPackage: proofPkg,
        patientPublicKey: address,
        escrowContractId: env.claimEscrowId(),
        rpcUrl: env.rpcUrl,
        networkPassphrase: env.networkPassphrase,
      });

      const sorobanDebug: SorobanDebugSink = (level, step, data) => {
        const label = `[Soroban] ${step}`;
        if (level === "error") log.error(label, data);
        else if (level === "warn") log.warn(label, data);
        else log.info(label, data);
      };

      let sorobanSignAttempt = 0;

      const result = await submitClaim({
        rpcUrl: env.rpcUrl,
        debug: sorobanDebug,
        onRetry: (attempt) => {
          log.warn(
            "Soroban metadata expired — re-simulating and re-signing in Freighter…",
            { attempt },
          );
        },
        signTransaction: async () => {
          const attempt = sorobanSignAttempt++;
          const unsigned = await getUnsigned();
          log.info(
            "Simulating + signing (approve Freighter when prompted)…",
            { attempt },
          );
          const signed = await signSorobanClaimTransaction(
            unsigned,
            env.rpcUrl,
            env.networkPassphrase,
            address,
            { debug: sorobanDebug, attempt },
          );
          assertSorobanTransactionReady(signed);
          log.success("Freighter signed — submitting immediately", {
            fee: signed.fee,
            attempt,
          });
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
        claimId: claim.id,
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
        patientAddress: address,
        payload,
      });
      log.success("Submit claim completed successfully");
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
          "Soroban transaction rejected at submit. Retry immediately. If this persists, run npm run redeploy:asp-escrow to deploy contract footprint fixes, then restart the dev server.",
        );
      } else if (msg.includes("Freighter changed the transaction body")) {
        setError(
          "Freighter network mismatch. Switch Freighter to Testnet (Settings → Network), refresh, and retry.",
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

  async function handleAddToPassport() {
    if (!receipt) return;
    setPassportBusy(true);
    setPassportError(null);
    try {
      await appendSettlementToPassport({
        patientAddress: receipt.patientAddress,
        nullifierHex: receipt.nullifier,
        txHash: receipt.txHash,
        payload: receipt.payload,
      });
      setPassportAdded(true);
    } catch (err) {
      setPassportError(
        err instanceof Error ? err.message : "Failed to add to passport",
      );
    } finally {
      setPassportBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="space-y-4">
        <div className="success-card space-y-3 p-6">
          <h3 className="text-lg font-[650] tracking-tight text-success">
            USDC received. Claim settled.
          </h3>
          <p className="text-3xl font-[650] tabular-nums tracking-tight">
            +{formatUsdc(receipt.usdcReceived)}
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">
            Confirmation: {receipt.nullifier}
          </p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${receipt.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline-primary inline-flex text-xs"
          >
            View on explorer
          </a>
        </div>

        {isPassportConfigured() ? (
          <div className="card-padded space-y-3">
            <p className="section-label">Health Passport</p>
            <h4 className="font-[650]">Add this claim to your Health Passport?</h4>
            <p className="text-sm text-muted-foreground">
              Prove your coverage history to hospitals, insurers, and employers —
              privately, from this app. Settlement does not add claims
              automatically — you must confirm below.
            </p>
            {passportError ? <ErrorBanner message={passportError} /> : null}
            {passportAdded ? (
              <p className="text-sm text-success">
                Claim added to your passport. View it in the Passport tab.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => void handleAddToPassport()}
                disabled={passportBusy}
                className="btn-primary w-full py-3"
              >
                {passportBusy ? "Adding to passport…" : "Add to Passport"}
              </button>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onComplete}
          className="btn-secondary w-full py-3"
        >
          View claim history
        </button>
        <SubmitClaimLogPanel entries={logEntries} />
      </div>
    );
  }

  if (claim.status === "submitted" && !receipt && !busy) {
    return (
      <div className="space-y-4">
        <div className="success-card space-y-3 p-6">
          <h3 className="text-lg font-[650] tracking-tight text-success">
            Claim already settled
          </h3>
          <p className="text-sm text-muted-foreground">
            This claim was submitted successfully. Use{" "}
            <strong className="font-[650] text-foreground">Add to Passport</strong>{" "}
            on the settlement screen right after submit, or open claim history if
            you navigated away before adding it.
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="btn-secondary w-full py-3"
          >
            View claim history
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="surface-row px-4 py-3">
        <p className="section-label">Selected claim</p>
        <p className="mt-1 font-[650] text-foreground">
          {claimSummary
            ? `${claimSummary.amount_label} · ${claimSummary.icd_code} · ${claimSummary.doctor_license_id}`
            : "Encrypted claim"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
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
          className="btn-primary w-full py-3 text-base"
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
