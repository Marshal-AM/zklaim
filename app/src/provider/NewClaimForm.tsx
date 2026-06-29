import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { computeClaimHash, fieldFromHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { useProviderEnrollment } from "../components/ProviderRegistration";
import { QrDisplay } from "../components/QrDisplay";
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
  } | null>(null);

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
    try {
      const doctorAddress = await ensureWalletConnected();
      if (!enrolled || !physician) {
        throw new Error("Provider not verified — register your wallet first");
      }

      const boxKey = await resolvePatientBoxKey();
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
      const signature = await freighterSignMessage(canonical, doctorAddress);
      const payload: ClaimTokenPayload = { ...base, doctor_signature: signature };
      const encrypted = await encryptClaimToken(payload, boxKey);
      const encoded = encodeTokenForUrl(encrypted);
      const deepLink = `${window.location.origin}/?claim=${encoded}`;

      let supabaseDelivered = false;
      if (supabaseEnabled) {
        await insertClaimDelivery({
          patientAddress: patientStellar,
          doctorAddress,
          token: encrypted,
          claimNonce: nonce,
        });
        supabaseDelivered = true;
      }

      setDelivery({ deepLink, cid: encrypted.cid, supabaseDelivered });
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
    } catch (err) {
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
          IPFS CID commitment: {delivery.cid}
        </p>
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
    </StepFormLayout>
  );
}
