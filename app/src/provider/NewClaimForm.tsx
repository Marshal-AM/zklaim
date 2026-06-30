import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeClaimHash, fieldFromHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { useProviderEnrollment } from "../components/ProviderRegistration";
import { QrDisplay } from "../components/QrDisplay";
import { ActivityLogPanel } from "../components/ActivityLogPanel";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { FormField } from "../components/ui/FormField";
import { CustomSelect } from "../components/ui/CustomSelect";
import { VisitDatePicker } from "../components/ui/VisitDatePicker";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import {
  encryptClaimToken,
  encodeTokenForUrl,
  canonicalClaimPayload,
  type ClaimTokenPayload,
  type EncryptedClaimToken,
} from "../lib/claimToken";
import { insertClaimDelivery } from "../lib/claimDelivery";
import { randomFieldHex, fetchJson } from "../lib/hydrateClaim";
import { freighterSignMessage } from "../lib/freighter";
import { lookupBoxPublicKey } from "../lib/patientProfile";
import {
  loadProviderHistory,
  saveProviderHistory,
} from "../lib/persistence";
import { useProviderStore } from "../store/providerStore";
import { useWalletStore } from "../store/wallet";
import { env } from "../config/env";
import { normalizeStellarAddress } from "../lib/stellarAddress";
import { toast } from "../lib/toast";
import {
  DEMO_DEFAULT_AMOUNT_USD,
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  formatDemoPolicyRange,
} from "../config/demoPolicy";
import {
  isValidVisitYmd,
  todayVisitYmd,
  visitYmdToDisplay,
  visitYmdToNumber,
} from "../lib/visitDate";
import {
  createActivityLogger,
  type ActivityLogEntry,
} from "../lib/activityLog";

interface PolicyLeaf {
  icd_code: string;
}

const STEPS = ["Patient", "Clinical", "Billing", "Review"] as const;

export function NewClaimForm() {
  const address = useWalletStore((s) => s.address);
  const addHistory = useProviderStore((s) => s.addHistory);
  const { enrolled, physician } = useProviderEnrollment(address);
  const [icdCodes, setIcdCodes] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [patientAddress, setPatientAddress] = useState("");
  const [patientBoxKey, setPatientBoxKey] = useState("");
  const [icdCode, setIcdCode] = useState("J18.9");
  const [amount, setAmount] = useState(DEMO_DEFAULT_AMOUNT_USD);
  const [visitDate, setVisitDate] = useState(todayVisitYmd);
  const [busy, setBusy] = useState(false);
  const [delivery, setDelivery] = useState<{
    deepLink: string;
    cid: string;
    supabaseDelivered: boolean;
    insurerViewAttached: boolean;
    token: EncryptedClaimToken;
  } | null>(null);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);

  const appendLog = useCallback((entry: ActivityLogEntry) => {
    setLogEntries((prev) => [...prev, entry]);
  }, []);

  const log = useMemo(
    () => createActivityLogger(appendLog, { prefix: "[ZKlaim Provider]" }),
    [appendLog],
  );

  const supabaseEnabled = env.isSupabaseEnabled();

  const icdOptions = useMemo(
    () => icdCodes.map((c) => ({ value: c, label: c })),
    [icdCodes],
  );

  useEffect(() => {
    void fetchJson<{ leaves: PolicyLeaf[] }>("/trees/policy_tree.json").then(
      (t) => setIcdCodes(t.leaves.map((l) => l.icd_code)),
    );
  }, []);

  async function resolvePatientBoxKey(): Promise<string> {
    const stellar = normalizeStellarAddress(patientAddress);
    if (supabaseEnabled) {
      const key = await lookupBoxPublicKey(stellar);
      if (!key) {
        throw new Error(
          "Patient not registered in ZKlaim directory. Ask them to complete patient onboarding first.",
        );
      }
      return key;
    }
    if (!patientBoxKey.trim()) {
      throw new Error("Patient encryption key is required when Supabase is not configured.");
    }
    return patientBoxKey.trim();
  }

  function validateStep(current: number): boolean {
    try {
      if (current === 0) {
        normalizeStellarAddress(patientAddress);
        if (!supabaseEnabled && !patientBoxKey.trim()) {
          throw new Error("Patient encryption key is required.");
        }
      }
      if (current === 1) {
        if (!icdCode.trim()) throw new Error("Select an ICD-10 code.");
        if (!isValidVisitYmd(visitDate)) {
          throw new Error("Enter a valid visit date (YYYYMMDD).");
        }
      }
      if (current === 2) {
        const amountCents = Math.round(parseFloat(amount) * 100);
        if (!Number.isFinite(amountCents) || amountCents < DEMO_POLICY_FLOOR_CENTS) {
          throw new Error(
            `Minimum billed amount is $${(DEMO_POLICY_FLOOR_CENTS / 100).toFixed(2)}`,
          );
        }
        if (amountCents > DEMO_POLICY_CEILING_CENTS) {
          throw new Error(
            `Maximum billed amount is $${(DEMO_POLICY_CEILING_CENTS / 100).toFixed(2)}`,
          );
        }
      }
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid input");
      return false;
    }
  }

  function handleNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!validateStep(2)) return;
    setBusy(true);
    setLogEntries([]);
    log.clear();
    log.info("Create claim started", {
      patientAddress,
      icdCode,
      visitDate,
      amount,
      supabaseEnabled,
      insurerViewConfigured: env.hasInsurerViewKey(),
    });
    try {
      log.info("Connecting provider Freighter wallet…");
      const doctorAddress = await ensureWalletConnected();
      log.success("Provider wallet connected", { doctorAddress });
      if (!enrolled || !physician) {
        throw new Error("Provider not verified — register your wallet first");
      }
      log.success("ASP credential loaded", {
        license_id: physician.license_id,
        specialty: physician.specialty_code,
      });

      log.info("Resolving patient encryption key…");
      const boxKey = await resolvePatientBoxKey();
      log.success("Patient box public key resolved", {
        key_preview: `${boxKey.slice(0, 12)}…`,
      });

      const patientStellar = normalizeStellarAddress(patientAddress);
      const nonce = randomFieldHex();
      const blinding = randomFieldHex();
      const amountCents = Math.round(parseFloat(amount) * 100);
      const visitNum = visitYmdToNumber(visitDate);

      const base: Omit<ClaimTokenPayload, "doctor_signature"> = {
        version: 1,
        patientAddress: patientStellar,
        icd_code: icdCode,
        amount_cents: amountCents,
        visit_date: visitNum,
        policy_id: "DEMO-POLICY-001",
        nonce,
        policy_floor_cents: DEMO_POLICY_FLOOR_CENTS,
        policy_ceiling_cents: DEMO_POLICY_CEILING_CENTS,
        doctor_license_id: physician.license_id,
        blinding_factor: blinding,
        doctor_address: doctorAddress,
      };

      const canonical = canonicalClaimPayload({ ...base, doctor_signature: "" });
      log.info("Requesting Freighter message signature for claim attestation…");
      const signature = await freighterSignMessage(canonical, doctorAddress);
      log.success("Doctor attestation signed", {
        signature_preview: `${signature.slice(0, 16)}…`,
      });

      const payload: ClaimTokenPayload = { ...base, doctor_signature: signature };
      const insurerViewPublicKey = env.insurerViewPublicKey();
      log.info("Encrypting claim token for patient (NaCl box)…");
      const encrypted = await encryptClaimToken(payload, boxKey, {
        insurerViewPublicKey: insurerViewPublicKey || undefined,
      });
      if (encrypted.insurer_view) {
        log.success("Insurer view-key envelope attached (selective disclosure)", {
          insurer_fund: env.insurerFundAddress(),
        });
      } else {
        log.warn(
          "No insurer view key configured — set VITE_INSURER_VIEW_PUBLIC_KEY for selective disclosure",
        );
      }
      log.success("Claim ciphertext sealed", {
        content_address: encrypted.cid,
        ciphertext_bytes: encrypted.ciphertext.length,
      });

      const encoded = encodeTokenForUrl(encrypted);
      const deepLink = `${window.location.origin}/?claim=${encoded}`;
      log.success("Deep link generated", { deepLink_preview: `${deepLink.slice(0, 48)}…` });

      let supabaseDelivered = false;
      if (supabaseEnabled) {
        log.info("Inserting encrypted delivery into Supabase inbox…");
        await insertClaimDelivery({
          patientAddress: patientStellar,
          doctorAddress,
          token: encrypted,
          claimNonce: nonce,
        });
        supabaseDelivered = true;
        log.success("Supabase claim_deliveries row inserted");
      }

      setDelivery({
        deepLink,
        cid: encrypted.cid,
        supabaseDelivered,
        insurerViewAttached: Boolean(encrypted.insurer_view),
        token: encrypted,
      });
      toast.success(
        supabaseDelivered
          ? "Claim signed and delivered to patient inbox"
          : "Claim signed — share the link with your patient",
      );

      const claimHash = await computeClaimHash({
        visitDate: visitNum,
        policyId: payload.policy_id,
        nonce: fieldFromHex(nonce),
      });
      log.success("Claim hash computed (links ZK circuits)", {
        claim_hash: claimHash.toString(16),
      });

      const entry = {
        claim_hash: claimHash.toString(16),
        date: new Date().toISOString(),
        patientAddress: patientStellar,
        icd_code: icdCode,
        visit_date: visitNum,
        amount_cents: amountCents,
        license_id: physician.license_id,
        delivered_to_inbox: supabaseDelivered,
      };
      addHistory(entry);
      const hist = await loadProviderHistory();
      await saveProviderHistory([entry, ...hist]);
      log.success("Provider local history updated");
    } catch (err) {
      log.error("Create claim failed", err);
      toast.error(err instanceof Error ? err.message : "Failed to create claim");
    } finally {
      setBusy(false);
    }
  }

  if (delivery) {
    return (
      <StepFormLayout fitParent className="space-y-4">
        <h3 className="text-lg font-[650] tracking-tight">Claim sent to patient</h3>
        <QrDisplay
          value={delivery.deepLink}
          label="Patient can also open this link"
        />
        <p className="text-safe-mono text-xs text-subtle">
          Content address: {delivery.cid}
        </p>
        {delivery.insurerViewAttached ? (
          <p className="text-xs text-muted-foreground">
            Insurer selective-disclosure envelope included (view key).
          </p>
        ) : null}
        {delivery.insurerViewAttached ? (
          <button
            type="button"
            className="btn-secondary w-full py-2.5 text-sm"
            onClick={async () => {
              const json = JSON.stringify(delivery.token, null, 2);
              try {
                await navigator.clipboard.writeText(json);
                toast.success("Encrypted token copied — paste in Admin → Insurer audit");
              } catch {
                toast.error("Could not copy to clipboard");
              }
            }}
          >
            Copy for insurer audit
          </button>
        ) : null}
        <ActivityLogPanel entries={logEntries} title="Provider activity log" />
      </StepFormLayout>
    );
  }

  return (
    <StepFormLayout fitParent className="space-y-6">
      <div className="credential-strip">
        <div className="credential-strip__meta">
          <span className="badge-primary">Signing as</span>
          <span className="font-[650] text-sm text-foreground">
            {physician?.license_id}
          </span>
          <span className="text-xs text-muted-foreground">
            {physician?.specialty_code}
          </span>
        </div>
        <Link to="/provider/register" className="credential-strip__action">
          Change
        </Link>
      </div>

      <StepFormProgress steps={[...STEPS]} currentStep={step} />

      {step === 0 ? (
        <div className="space-y-5 animate-fade-in">
          <FormField
            label="Patient Stellar address"
            hint={
              supabaseEnabled
                ? "We look up their encryption key from the ZKlaim directory automatically."
                : "Paste the patient's public encryption key from their identity portal."
            }
          >
            <input
              required
              value={patientAddress}
              onChange={(e) => setPatientAddress(e.target.value)}
              className="input-field-lg font-mono"
              placeholder="G…"
              autoComplete="off"
            />
          </FormField>
          {!supabaseEnabled ? (
            <FormField label="Patient encryption key">
              <textarea
                required
                value={patientBoxKey}
                onChange={(e) => setPatientBoxKey(e.target.value)}
                className="input-field min-h-[88px] font-mono text-xs"
                placeholder="From patient identity page"
              />
            </FormField>
          ) : null}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-5 animate-fade-in">
          <FormField label="ICD-10 diagnosis code" hint="Covered codes from demo policy tree.">
            <CustomSelect
              options={icdOptions}
              value={icdCode}
              onChange={setIcdCode}
              placeholder="Select ICD-10 code"
            />
          </FormField>
          <FormField
            label="Visit date"
            hint={`Claim format: ${visitDate} (${visitYmdToDisplay(visitDate)})`}
          >
            <VisitDatePicker value={visitDate} onChange={setVisitDate} />
          </FormField>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-5 animate-fade-in">
          <FormField
            label="Billed amount (USD)"
            hint={`Demo policy range: ${formatDemoPolicyRange()}`}
          >
            <div className="input-group input-group--lg">
              <span className="input-group__prefix" aria-hidden>
                $
              </span>
              <input
                required
                type="number"
                min={DEMO_POLICY_FLOOR_CENTS / 100}
                max={DEMO_POLICY_CEILING_CENTS / 100}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="input-group__field"
                aria-label="Billed amount in US dollars"
              />
            </div>
          </FormField>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="surface-row space-y-3 p-4 text-sm animate-fade-in min-w-0">
          <p className="section-label">Review before signing</p>
          <DetailList>
            <DetailRow term="Patient" value={patientAddress} mono />
            <DetailRow term="ICD-10" value={icdCode} />
            <DetailRow term="Visit" value={visitYmdToDisplay(visitDate)} />
            <DetailRow
              term="Amount"
              value={`$${parseFloat(amount).toFixed(2)}`}
            />
            <DetailRow term="Credential" value={physician?.license_id ?? "—"} />
          </DetailList>
        </div>
      ) : null}

      <StepFormNav
        onBack={step > 0 ? handleBack : undefined}
        onNext={step < STEPS.length - 1 ? handleNext : () => void handleSubmit()}
        nextLabel={step < STEPS.length - 1 ? "Continue" : "Sign & Send to Patient"}
        isLastStep={step === STEPS.length - 1}
        nextDisabled={!enrolled}
        busy={busy}
      />
      <ActivityLogPanel
        entries={logEntries}
        title="Provider activity log"
        emptyMessage="Activity from signing and delivery will appear here."
      />
    </StepFormLayout>
  );
}
