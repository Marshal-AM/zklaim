import { useCallback, useMemo, useState } from "react";
import { requireAdminSigning } from "../lib/adminWallet";
import { explainAdminContractError } from "../lib/adminErrors";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import { ActivityLogPanel } from "../components/ActivityLogPanel";
import { enrollDoctor } from "../lib/contracts";
import { invalidateTreeAlignmentCache } from "../lib/treeChainAlignment";
import { createActivityLogger, type ActivityLogEntry } from "../lib/activityLog";
import { toast } from "../lib/toast";

const STEPS = ["License", "Specialty", "Jurisdiction", "Review"] as const;

export function DoctorEnrollment() {
  const [step, setStep] = useState(0);
  const [licenseHash, setLicenseHash] = useState("");
  const [specialty, setSpecialty] = useState("PULM");
  const [jurisdiction, setJurisdiction] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);
  const appendLog = useCallback((e: ActivityLogEntry) => {
    setLogEntries((prev) => [...prev, e]);
  }, []);
  const log = useMemo(
    () => createActivityLogger(appendLog, { prefix: "[ZKlaim Admin]" }),
    [appendLog],
  );

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
    setLogEntries([]);
    log.clear();
    log.info("enroll_doctor started", { licenseHash, specialty, jurisdiction });
    try {
      const admin = requireAdminSigning();
      log.success("Admin signer ready", { admin });
      const result = await enrollDoctor({
        admin,
        licenseHash: licenseHash.replace(/^0x/, ""),
        specialtyCode: specialty,
        jurisdictionHash: jurisdiction.replace(/^0x/, ""),
        log,
      });
      setTxHash(result.hash);
      invalidateTreeAlignmentCache();
      toast.success(
        "Doctor enrolled on-chain — run npm run redeploy:asp-escrow and restart dev to resync proofs",
      );
    } catch (err) {
      log.error("enroll_doctor failed", err);
      toast.error(
        explainAdminContractError(
          err instanceof Error ? err.message : "Enrollment failed",
        ),
      );
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
      <div className="info-card border-primary/30 p-3 text-xs text-muted-foreground">
        Manual <code className="font-mono text-foreground">enroll_doctor</code>{" "}
        appends a new ASP leaf and changes the on-chain Merkle root. Patient proofs
        use static tree artifacts — after enrolling here you must run{" "}
        <code className="font-mono text-foreground">npm run redeploy:asp-escrow</code>{" "}
        and restart the dev server.
      </div>
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
      <ActivityLogPanel entries={logEntries} title="Admin activity log" />
    </StepFormLayout>
  );
}
