import { useState } from "react";
import { Link } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { StepFormNav } from "../components/ui/StepFormNav";
import { StepFormProgress } from "../components/ui/StepFormProgress";
import { StepFormLayout } from "../components/ui/StepFormLayout";
import { ensureWalletConnected } from "../lib/walletSession";
import { usePatientStore } from "../store/patientStore";
import { useWalletStore } from "../store/wallet";
import { loadPassportStore } from "../lib/passportStore";
import {
  EXCLUDABLE_CATEGORIES,
  ICD_CATEGORY_NAMES,
} from "../lib/passportCategories";
import {
  proveCategoryNonMembership,
  refreshPassportLeavesForProve,
} from "../lib/passportCredential";
import {
  explainPassportCredentialError,
  ensurePassportVerifierWhitelisted,
  isPassportConfigured,
  readPassportRoot,
  verifyPassportCredential,
} from "../lib/passportContract";
import { passportRootToBigint } from "../lib/passportAppend";
import { saveCredentialSession } from "../lib/credentialStore";
import { toast } from "../lib/toast";

const TTL_LEDGERS = 50_000;
const STEPS = ["Verifier", "Categories", "Review"] as const;

export function PatientPassportSharePage() {
  const identity = usePatientStore((s) => s.identity);
  const activeWalletAddress = usePatientStore((s) => s.activeWalletAddress);
  const walletAddress = useWalletStore((s) => s.address);
  const [step, setStep] = useState(0);
  const [excluded, setExcluded] = useState<string[]>(["C"]);
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [issuedProofs, setIssuedProofs] = useState<
    Array<{ credentialId: number; excludedCategory: string; txHash: string }>
  >([]);

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

    const verifierAddr = verifier.trim();
    setBusy(true);
    try {
      const patient = await ensureWalletConnected();
      const whitelist = await ensurePassportVerifierWhitelisted(verifierAddr);
      if (whitelist.newlyRegistered) {
        toast.success("Verifier auto-whitelisted on-chain");
      }

      const store = await loadPassportStore(patient);
      if (!store || store.leaves.length === 0) {
        throw new Error("No claims in passport — settle and add a claim first");
      }

      const rootHex = await readPassportRoot(patient);
      const root = passportRootToBigint(rootHex);
      const refreshedLeaves = await refreshPassportLeavesForProve(
        patient,
        store,
      );

      const proofs: Array<{
        credentialId: number;
        excludedCategory: string;
        publicInputHex: string[];
        txHash: string;
      }> = [];

      for (const category of excluded) {
        const { proof, publicInputs } = await proveCategoryNonMembership({
          store,
          passportRoot: root,
          excludedCategory: category,
          leaves: refreshedLeaves,
        });
        const result = await verifyPassportCredential({
          patient,
          verifier: verifierAddr,
          circuitId: 4,
          publicInputHex: publicInputs,
          proof,
          ttlLedgers: TTL_LEDGERS,
        });
        if (result.credentialId === undefined) {
          throw new Error(
            "Credential submitted but id not returned — check transaction on explorer",
          );
        }
        proofs.push({
          credentialId: result.credentialId,
          excludedCategory: category,
          publicInputHex: publicInputs,
          txHash: result.hash,
        });
      }

      saveCredentialSession(patient, {
        patient,
        verifier: verifierAddr,
        passportRoot: rootHex,
        claimCount: store.leaves.length,
        circuitId: 4,
        ttlLedgers: TTL_LEDGERS,
        proofs,
      });

      setIssuedProofs(
        proofs.map((p) => ({
          credentialId: p.credentialId,
          excludedCategory: p.excludedCategory,
          txHash: p.txHash,
        })),
      );
      toast.success("Credential submitted on-chain");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Credential failed";
      toast.error(explainPassportCredentialError(raw));
    } finally {
      setBusy(false);
    }
  }

  if (!walletAddress) {
    return (
      <SectionCard label="Wallet" title="Connect your patient wallet">
        <p className="text-sm text-muted-foreground">
          Connect Freighter to generate passport credentials for this account.
        </p>
      </SectionCard>
    );
  }

  if (!identity || !activeWalletAddress) {
    return (
      <SectionCard label="Setup required" title="Complete identity setup first">
        <p className="text-sm text-muted-foreground">
          Set up your identity for this wallet before sharing credentials.
        </p>
      </SectionCard>
    );
  }

  if (issuedProofs.length > 0) {
    return (
      <div className="space-y-6">
        <SectionCard label="Share" title="Credential generated">
          <p className="text-sm text-muted-foreground">
            Your verifier can validate these credentials on-chain. Share the credential
            id(s) below.
          </p>
          <DetailList className="mt-4">
            {issuedProofs.map((p) => (
              <DetailRow
                key={p.credentialId}
                term={`#${p.credentialId}`}
                value={`Exclude ${ICD_CATEGORY_NAMES[p.excludedCategory]} (${p.excludedCategory})`}
              />
            ))}
          </DetailList>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={`/verifier?id=${issuedProofs[0].credentialId}`}
              className="btn-primary inline-flex text-xs"
            >
              Open verifier check
            </Link>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${issuedProofs[issuedProofs.length - 1].txHash}`}
              target="_blank"
              rel="noreferrer"
              className="btn-outline-primary inline-flex text-xs"
            >
              View last transaction
            </a>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard label="Share" title="Generate a credential">
        <p className="text-sm text-muted-foreground">
          Prove absence of selected ICD categories over your passport history.
          The verifier address is auto-whitelisted on-chain when needed (via admin key in .env).
        </p>

        <StepFormLayout size="lg" className="mt-6 space-y-4">
          <StepFormProgress steps={[...STEPS]} currentStep={step} />

          {step === 0 ? (
            <FormField
              label="Verifier Stellar address"
              hint="Hospital, insurer, or employer wallet. Whitelisted automatically if not already registered."
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
    </div>
  );
}
