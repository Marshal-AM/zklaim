import { useEffect, useState } from "react";
import { fieldToHex, initPoseidon2, poseidon2HashFixed } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import { registerPolicy } from "../lib/contracts";
import { fetchJson } from "../lib/hydrateClaim";
import {
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  formatDemoPolicyRange,
} from "../config/demoPolicy";
import { toast } from "../lib/toast";

const STEPS = ["Coverage", "Bounds", "Review"] as const;

export function PolicyRegistration() {
  const [step, setStep] = useState(0);
  const [coverageRoot, setCoverageRoot] = useState("");
  const [boundsHash, setBoundsHash] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchJson<{ root: string }>("/trees/policy_tree.json").then((t) =>
      setCoverageRoot(t.root.replace(/^0x/, "")),
    );
  }, []);

  useEffect(() => {
    void (async () => {
      await initPoseidon2();
      const hash = await poseidon2HashFixed([
        BigInt(DEMO_POLICY_FLOOR_CENTS),
        BigInt(DEMO_POLICY_CEILING_CENTS),
      ]);
      setBoundsHash(fieldToHex(hash).replace(/^0x/, ""));
    })();
  }, []);

  function validateStep(current: number): boolean {
    if (current === 0 && !coverageRoot.trim()) {
      toast.error("Coverage root is required.");
      return false;
    }
    if (current === 1 && !boundsHash.trim()) {
      toast.error("Bounds hash is required.");
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
    if (!validateStep(1)) return;
    setBusy(true);
    try {
      const insurer = await ensureWalletConnected();
      const result = await registerPolicy({
        insurer,
        coverageRoot,
        boundsHash,
        expiryLedger: 4_000_000_000,
      });
      setTxHash(result.hash);
      toast.success("Policy registered on-chain");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  if (txHash) {
    return (
      <div className="surface-row space-y-2 p-4 text-sm">
        <p className="font-[650] text-success">Policy registered</p>
        <p className="text-safe-mono text-xs text-muted-foreground">{txHash}</p>
      </div>
    );
  }

  return (
    <StepFormLayout className="space-y-4">
      <p className="text-center text-xs text-muted-foreground">
        Demo policy band: {formatDemoPolicyRange()}. Re-register after changing
        bounds so on-chain proofs match patient claims.
      </p>

      <StepFormProgress steps={[...STEPS]} currentStep={step} />

      {step === 0 ? (
        <FormField
          label="Coverage root"
          hint="Merkle root of covered ICD-10 codes from policy_tree.json."
        >
          <input
            required
            value={coverageRoot}
            onChange={(e) => setCoverageRoot(e.target.value)}
            className="input-field-lg font-mono text-xs"
          />
        </FormField>
      ) : null}

      {step === 1 ? (
        <FormField
          label="Bounds hash"
          hint={`Poseidon hash of demo floor/ceiling (${formatDemoPolicyRange()}).`}
        >
          <input
            required
            value={boundsHash}
            onChange={(e) => setBoundsHash(e.target.value)}
            className="input-field-lg font-mono text-xs"
          />
        </FormField>
      ) : null}

      {step === 2 ? (
        <div className="surface-row space-y-3 p-4 text-sm min-w-0">
          <p className="section-label">Review policy registration</p>
          <DetailList>
            <DetailRow term="Coverage root" value={coverageRoot} mono />
            <DetailRow term="Bounds hash" value={boundsHash} mono />
          </DetailList>
        </div>
      ) : null}

      <StepFormNav
        onBack={step > 0 ? handleBack : undefined}
        onNext={step < STEPS.length - 1 ? handleNext : () => void handleSubmit()}
        nextLabel={step < STEPS.length - 1 ? "Continue" : "Register policy"}
        isLastStep={step === STEPS.length - 1}
        busy={busy}
      />
    </StepFormLayout>
  );
}
