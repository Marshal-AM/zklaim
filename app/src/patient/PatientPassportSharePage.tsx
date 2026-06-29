import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import { ensureWalletConnected } from "../lib/walletSession";
import { loadPassportStore } from "../lib/passportStore";
import {
  EXCLUDABLE_CATEGORIES,
  ICD_CATEGORY_NAMES,
} from "../lib/passportCategories";
import { proveCategoryNonMembership } from "../lib/passportCredential";
import {
  isPassportConfigured,
  readPassportRoot,
  verifyPassportCredential,
} from "../lib/passportContract";
import { passportRootToBigint } from "../lib/passportAppend";
import { toast } from "../lib/toast";

const TTL_LEDGERS = 50_000;
const STEPS = ["Verifier", "Categories", "Review"] as const;

export function PatientPassportSharePage() {
  const [step, setStep] = useState(0);
  const [excluded, setExcluded] = useState<string[]>(["C"]);
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  function toggleCategory(letter: string) {
    setExcluded((prev) =>
      prev.includes(letter)
        ? prev.filter((c) => c !== letter)
        : [...prev, letter],
    );
  }

  function validateStep(current: number): boolean {
    if (current === 0 && !verifier.trim()) {
      toast.error("Enter the verifier Stellar address.");
      return false;
    }
    if (current === 1 && excluded.length === 0) {
      toast.error("Select at least one category to prove absence.");
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

  async function handleGenerate() {
    if (!isPassportConfigured()) {
      toast.error("Passport registry not configured");
      return;
    }
    if (!validateStep(0) || !validateStep(1)) return;

    setBusy(true);
    try {
      const patient = await ensureWalletConnected();
      const store = await loadPassportStore();
      if (!store || store.leaves.length === 0) {
        throw new Error("No claims in passport — settle and add a claim first");
      }

      const rootHex = await readPassportRoot(patient);
      const root = passportRootToBigint(rootHex);

      let lastHash: string | null = null;
      for (const category of excluded) {
        const { proof, publicInputs } = await proveCategoryNonMembership({
          store,
          passportRoot: root,
          excludedCategory: category,
        });
        const result = await verifyPassportCredential({
          patient,
          verifier: verifier.trim(),
          circuitId: 4,
          publicInputHex: publicInputs,
          proof,
          ttlLedgers: TTL_LEDGERS,
        });
        lastHash = result.hash;
      }
      setTxHash(lastHash);
      toast.success("Credential submitted on-chain");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Credential failed");
    } finally {
      setBusy(false);
    }
  }

  if (txHash) {
    return (
      <div className="space-y-6">
        <SectionCard label="Share" title="Credential generated">
          <p className="text-sm text-muted-foreground">
            Your verifier can now check absence proofs on-chain.
          </p>
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="btn-outline-primary mt-4 inline-flex text-xs"
          >
            View transaction
          </a>
        </SectionCard>
        <Link to="/patient/passport" className="btn-secondary inline-flex">
          Back to passport
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard label="Share" title="Generate a credential">
        <p className="text-sm text-muted-foreground">
          Prove absence of selected ICD categories over your passport history.
          Verifier must be registered by admin on-chain.
        </p>

        <StepFormLayout size="lg" className="mt-6 space-y-4">
          <StepFormProgress steps={[...STEPS]} currentStep={step} />

          {step === 0 ? (
            <FormField
              label="Verifier Stellar address"
              hint="Hospital, insurer, or employer wallet registered as a verifier."
            >
              <input
                className="input-field-lg font-mono"
                value={verifier}
                onChange={(e) => setVerifier(e.target.value)}
                placeholder="G…"
              />
            </FormField>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <p className="section-label">Categories to prove absent</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {EXCLUDABLE_CATEGORIES.map((letter) => {
                  const selected = excluded.includes(letter);
                  return (
                    <li key={letter}>
                      <button
                        type="button"
                        onClick={() => toggleCategory(letter)}
                        className={`choice-card w-full text-left ${
                          selected ? "choice-card--selected" : ""
                        }`}
                      >
                        <span className="choice-card__title">
                          {ICD_CATEGORY_NAMES[letter]}
                        </span>
                        <span className="choice-card__desc">
                          Category {letter} — {selected ? "Proving absence" : "Tap to include"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="surface-row space-y-3 p-4 text-sm min-w-0">
              <p className="section-label">Review credential</p>
              <DetailList>
                <DetailRow term="Verifier" value={verifier} mono />
              </DetailList>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Excluded categories</p>
                <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                  {excluded.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-[650] text-primary"
                    >
                      {ICD_CATEGORY_NAMES[c]} ({c})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <StepFormNav
            onBack={step > 0 ? handleBack : undefined}
            onNext={
              step < STEPS.length - 1
                ? handleNext
                : () => void handleGenerate()
            }
            nextLabel={step < STEPS.length - 1 ? "Continue" : "Generate credential"}
            isLastStep={step === STEPS.length - 1}
            busy={busy}
          />
        </StepFormLayout>
      </SectionCard>

      <Link to="/patient/passport" className="btn-secondary inline-flex">
        Back to passport
      </Link>
    </div>
  );
}
