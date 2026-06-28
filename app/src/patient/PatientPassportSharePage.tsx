import { useState } from "react";
import { Link } from "react-router-dom";
import { ErrorBanner } from "../components/ErrorBanner";
import { SectionCard } from "../components/ui/SectionCard";
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

const TTL_LEDGERS = 50_000;

export function PatientPassportSharePage() {
  const [excluded, setExcluded] = useState<string[]>(["C"]);
  const [verifier, setVerifier] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [credentialId, setCredentialId] = useState<number | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  function toggleCategory(letter: string) {
    setExcluded((prev) =>
      prev.includes(letter)
        ? prev.filter((c) => c !== letter)
        : [...prev, letter],
    );
  }

  async function handleGenerate() {
    if (!isPassportConfigured()) {
      setError("Passport registry not configured");
      return;
    }
    if (!verifier.trim()) {
      setError("Enter verifier Stellar address");
      return;
    }
    if (excluded.length === 0) {
      setError("Select at least one category to prove absence");
      return;
    }

    setBusy(true);
    setError(null);
    setCredentialId(null);

    try {
      const patient = await ensureWalletConnected();
      const store = await loadPassportStore();
      if (!store || store.leaves.length === 0) {
        throw new Error("No claims in passport — settle and add a claim first");
      }

      const rootHex = await readPassportRoot(patient);
      const root = passportRootToBigint(rootHex);

      // One credential per excluded category (circuit proves one at a time)
      let lastId: number | null = null;
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
        // credential id not returned from sim — user verifies via follow-up
        lastId = lastId === null ? 1 : lastId + 1;
      }
      setCredentialId(lastId);
      setTxHash(lastHash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Credential failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard label="Share" title="Generate a credential">
        <p className="text-sm text-muted-foreground">
          Prove absence of selected ICD categories over your passport history.
          Verifier must be registered by admin on-chain.
        </p>

        <label className="mt-4 block text-sm">
          <span className="text-muted-foreground">Verifier Stellar address</span>
          <input
            className="input-field mt-1"
            value={verifier}
            onChange={(e) => setVerifier(e.target.value)}
            placeholder="G..."
          />
        </label>

        <p className="mt-4 text-sm font-[650]">Categories to prove absent</p>
        <ul className="mt-2 space-y-2">
          {EXCLUDABLE_CATEGORIES.map((letter) => (
            <li key={letter}>
              <button
                type="button"
                onClick={() => toggleCategory(letter)}
                className={`surface-row w-full px-4 py-2 text-left text-sm ${
                  excluded.includes(letter) ? "border-primary/40 bg-primary/10" : ""
                }`}
              >
                {ICD_CATEGORY_NAMES[letter]} ({letter}) —{" "}
                {excluded.includes(letter) ? "Proving" : "Off"}
              </button>
            </li>
          ))}
        </ul>

        {error ? <ErrorBanner message={error} /> : null}

        {credentialId !== null ? (
          <div className="success-card mt-4 p-4 text-sm">
            <p className="font-[650] text-success">Credential submitted on-chain</p>
            {txHash ? (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-primary underline"
              >
                View transaction
              </a>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={busy}
            className="btn-primary mt-4 w-full py-3"
          >
            {busy ? "Generating credential…" : "Generate credential"}
          </button>
        )}
      </SectionCard>

      <Link to="/patient/passport" className="btn-secondary inline-flex">
        Back to passport
      </Link>
    </div>
  );
}
