import { useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import { enrollDoctor } from "../lib/contracts";
import { toast } from "../lib/toast";

const STEPS = ["License", "Specialty", "Jurisdiction", "Review"] as const;

export function DoctorEnrollment() {
  const [step, setStep] = useState(0);
  const [licenseHash, setLicenseHash] = useState("");
  const [specialty, setSpecialty] = useState("PULM");
  const [jurisdiction, setJurisdiction] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validateStep(current: number): boolean {
    if (current === 0 && !licenseHash.trim()) {
      toast.error("Enter the license hash.");
      return false;
    }
    if (current === 1 && !specialty.trim()) {
      toast.error("Enter a specialty code.");
      return false;
    }
    if (current === 2 && !jurisdiction.trim()) {
      toast.error("Enter the jurisdiction hash.");
      return false;
    }
    return true;
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
      const admin = await ensureWalletConnected();
      const result = await enrollDoctor({
        admin,
        licenseHash: licenseHash.replace(/^0x/, ""),
        specialtyCode: specialty,
        jurisdictionHash: jurisdiction.replace(/^0x/, ""),
      });
      setTxHash(result.hash);
      toast.success("Doctor enrolled on-chain");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  if (txHash) {
    return (
      <div className="surface-row space-y-2 p-4 text-sm">
        <p className="font-[650] text-success">Enrollment submitted</p>
        <a
          href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
          target="_blank"
          rel="noreferrer"
          className="block text-safe-mono text-xs text-primary underline"
        >
          {txHash}
        </a>
      </div>
    );
  }

  return (
    <StepFormLayout className="space-y-4">
      <StepFormProgress steps={[...STEPS]} currentStep={step} />

      {step === 0 ? (
        <FormField
          label="License hash"
          hint="Hex digest of the physician license credential."
        >
          <input
            required
            value={licenseHash}
            onChange={(e) => setLicenseHash(e.target.value)}
            className="input-field-lg font-mono"
            placeholder="license_hash"
          />
        </FormField>
      ) : null}

      {step === 1 ? (
        <FormField
          label="Specialty code"
          hint="Short code used in ASP proofs (e.g. PULM, PSY, ONC)."
        >
          <input
            required
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value.toUpperCase())}
            className="input-field-lg font-mono tracking-widest"
            placeholder="PULM"
            maxLength={8}
          />
        </FormField>
      ) : null}

      {step === 2 ? (
        <FormField
          label="Jurisdiction hash"
          hint="Hex digest of licensing jurisdiction metadata."
        >
          <input
            required
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            className="input-field-lg font-mono"
            placeholder="jurisdiction_hash"
          />
        </FormField>
      ) : null}

      {step === 3 ? (
        <div className="surface-row space-y-3 p-4 text-sm min-w-0">
          <p className="section-label">Review enrollment</p>
          <DetailList>
            <DetailRow term="License hash" value={licenseHash} mono />
            <DetailRow term="Specialty" value={specialty} />
            <DetailRow term="Jurisdiction" value={jurisdiction} mono />
          </DetailList>
        </div>
      ) : null}

      <StepFormNav
        onBack={step > 0 ? handleBack : undefined}
        onNext={step < STEPS.length - 1 ? handleNext : () => void handleSubmit()}
        nextLabel={step < STEPS.length - 1 ? "Continue" : "Enroll doctor"}
        isLastStep={step === STEPS.length - 1}
        busy={busy}
      />
    </StepFormLayout>
  );
}
