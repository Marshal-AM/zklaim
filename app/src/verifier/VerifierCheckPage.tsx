import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SectionCard } from "../components/ui/SectionCard";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { PageHeader } from "../components/ui/PageHeader";
import { PageContent } from "../components/ui/PageGrid";
import {
  findCredentialById,
  latestCredentialSession,
  listCredentialSessions,
  type StoredCredentialSession,
} from "../lib/credentialStore";
import {
  categoryLabel,
  CIRCUIT_NAMES,
  credentialValidityLabel,
  decodeCategoryNonMembershipInputs,
  letterFromExcludedField,
} from "../lib/credentialDisplay";
import {
  isPassportConfigured,
  isPassportCredentialValid,
  passportRegistryId,
} from "../lib/passportContract";
import { toast } from "../lib/toast";
import { useWalletStore } from "../store/wallet";
import { patientWalletId } from "../lib/patientWalletScope";

function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

function StatusBadge({ valid }: { valid: boolean | null }) {
  if (valid === null) {
    return (
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-[650] text-muted-foreground">
        Not checked
      </span>
    );
  }
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-[650] ${
        valid
          ? "bg-emerald-500/15 text-emerald-600"
          : "bg-destructive/15 text-destructive"
      }`}
    >
      {credentialValidityLabel(valid)}
    </span>
  );
}

function CredentialDetailPanel({
  credentialId,
  session,
  onChainValid,
  checking,
}: {
  credentialId: number;
  session: StoredCredentialSession | null;
  onChainValid: boolean | null;
  checking: boolean;
}) {
  const proof = session?.proofs.find((p) => p.credentialId === credentialId);
  const circuitId = session?.circuitId ?? 4;
  const decoded = proof
    ? decodeCategoryNonMembershipInputs(proof.publicInputHex)
    : null;
  const letter =
    proof?.excludedCategory ??
    (decoded ? letterFromExcludedField(decoded.excludedField) : null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-[650]">Credential #{credentialId}</h2>
        <StatusBadge valid={checking ? null : onChainValid} />
      </div>

      <DetailList>
        <DetailRow
          term="On-chain validity"
          value={
            checking
              ? "Checking…"
              : onChainValid === null
                ? "—"
                : credentialValidityLabel(onChainValid)
          }
        />
        <DetailRow term="Passport registry" value={passportRegistryId()} mono />
        <DetailRow term="Circuit" value={`${CIRCUIT_NAMES[circuitId] ?? circuitId} (id ${circuitId})`} />
        {session ? (
          <>
            <DetailRow term="Patient" value={session.patient} mono />
            <DetailRow term="Verifier" value={session.verifier} mono />
            <DetailRow term="Passport root" value={session.passportRoot} mono />
            <DetailRow term="Claim count" value={String(session.claimCount)} />
            <DetailRow term="TTL (ledgers)" value={String(session.ttlLedgers)} />
            <DetailRow term="Issued at" value={new Date(session.createdAt).toLocaleString()} />
          </>
        ) : (
          <DetailRow
            term="Local metadata"
            value="Not in this browser — only on-chain validity is shown."
          />
        )}
      </DetailList>

      {letter || proof ? (
        <SectionCard label="Proof statement" title="What this credential proves">
          <p className="text-sm text-muted-foreground">
            Zero-knowledge proof that the patient&apos;s passport history contains{" "}
            <strong>no claims</strong> in the excluded ICD category below, without
            revealing individual diagnoses or claim details.
          </p>
          <DetailList className="mt-4">
            {letter ? (
              <DetailRow
                term="Excluded category"
                value={`${categoryLabel(letter)} (${letter})`}
              />
            ) : null}
            {decoded ? (
              <>
                <DetailRow term="Passport root (public)" value={decoded.passportRoot} mono />
                <DetailRow term="Excluded field (BN254)" value={decoded.excludedField} mono />
                <DetailRow term="Claim count (public)" value={String(decoded.claimCount)} />
              </>
            ) : null}
          </DetailList>
        </SectionCard>
      ) : null}

      {proof ? (
        <SectionCard label="Transaction" title="On-chain issuance">
          <DetailList>
            <DetailRow term="Tx hash" value={proof.txHash} mono />
          </DetailList>
          <a
            href={explorerTxUrl(proof.txHash)}
            target="_blank"
            rel="noreferrer"
            className="btn-outline-primary mt-4 inline-flex text-xs"
          >
            View on Stellar Expert
          </a>
        </SectionCard>
      ) : null}

      {proof?.publicInputHex ? (
        <SectionCard label="Public inputs" title="On-chain public input vector">
          <ul className="space-y-2 font-mono text-xs text-muted-foreground break-all">
            {proof.publicInputHex.map((field, i) => (
              <li key={i}>
                <span className="text-foreground">[{i}]</span> {field}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard label="Privacy" title="What the verifier learns">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>That a valid ZK proof was verified for this credential id.</li>
          <li>Public inputs: passport Merkle root, excluded category field, claim count.</li>
          <li>That the patient address issued the credential for this verifier.</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          The verifier does <strong>not</strong> learn individual ICD codes, amounts,
          providers, or dates from the passport leaves.
        </p>
      </SectionCard>
    </div>
  );
}

export function VerifierCheckPage() {
  const walletAddress = useWalletStore((s) => s.address);
  const credentialWalletId = patientWalletId(walletAddress);
  const [searchParams, setSearchParams] = useSearchParams();
  const [credentialIdInput, setCredentialIdInput] = useState(
    () => searchParams.get("id") ?? "",
  );
  const [activeId, setActiveId] = useState<number | null>(null);
  const [onChainValid, setOnChainValid] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [sessions, setSessions] = useState<StoredCredentialSession[]>([]);

  const refreshSessions = useCallback(() => {
    if (!credentialWalletId) {
      setSessions([]);
      return;
    }
    setSessions(listCredentialSessions(credentialWalletId));
  }, [credentialWalletId]);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  const sessionForActive = useMemo(() => {
    if (activeId === null) return null;
    return findCredentialById(activeId, credentialWalletId)?.session ?? null;
  }, [activeId, credentialWalletId]);

  async function checkCredential(id: number) {
    if (!isPassportConfigured()) {
      toast.error("Passport registry not configured");
      return;
    }
    setActiveId(id);
    setSearchParams({ id: String(id) });
    setChecking(true);
    setOnChainValid(null);
    try {
      const valid = await isPassportCredentialValid(id);
      setOnChainValid(valid);
      if (valid) {
        toast.success(`Credential #${id} is valid on-chain`);
      } else {
        toast.error(`Credential #${id} is expired or invalid`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Check failed";
      toast.error(msg);
      setOnChainValid(null);
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(credentialIdInput.trim());
    if (!Number.isFinite(id) || id < 0) {
      toast.error("Enter a valid credential id (non-negative integer)");
      return;
    }
    void checkCredential(id);
  }

  useEffect(() => {
    const fromUrl = searchParams.get("id");
    if (fromUrl && /^\d+$/.test(fromUrl)) {
      const id = Number(fromUrl);
      if (activeId !== id) {
        void checkCredential(id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL id
  }, [searchParams]);

  if (!isPassportConfigured()) {
    return (
      <PageContent>
        <PageHeader
          title="Verifier check"
          subtitle="Validate patient-issued passport credentials on-chain."
        />
        <p className="text-sm text-muted-foreground">
          Set <code className="text-subtle">VITE_PASSPORT_REGISTRY_CONTRACT_ID</code> in .env.
        </p>
      </PageContent>
    );
  }

  const latest = credentialWalletId
    ? latestCredentialSession(credentialWalletId)
    : null;

  return (
    <PageContent>
      <PageHeader
        title="Verifier check"
        subtitle="Confirm a credential is valid on the passport registry."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <SectionCard label="Lookup" title="Check credential id">
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              label="Credential id"
              hint="Issued when the patient submits verify_credential on-chain. Recent ids from this browser are listed below."
            >
              <input
                className="input-field-lg font-mono"
                value={credentialIdInput}
                onChange={(e) => setCredentialIdInput(e.target.value)}
                placeholder="e.g. 1"
                inputMode="numeric"
              />
            </FormField>
            <button type="submit" className="btn-primary" disabled={checking}>
              {checking ? "Checking…" : "Verify on-chain"}
            </button>
          </form>

          {latest ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="section-label">Latest in this browser</p>
              <ul className="mt-2 space-y-2">
                {latest.proofs.map((p) => (
                  <li key={p.credentialId}>
                    <button
                      type="button"
                      className="text-left text-sm text-primary hover:underline"
                      onClick={() => {
                        setCredentialIdInput(String(p.credentialId));
                        void checkCredential(p.credentialId);
                      }}
                    >
                      #{p.credentialId} — exclude {categoryLabel(p.excludedCategory)} (
                      {p.excludedCategory})
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {sessions.length > 0 ? (
            <div className="mt-6 border-t border-border pt-4">
              <p className="section-label">All stored sessions</p>
              <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-xs">
                {sessions.map((s) => (
                  <li key={s.id} className="text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()} —{" "}
                    {s.proofs.map((p) => (
                      <button
                        key={p.credentialId}
                        type="button"
                        className="mr-2 text-primary hover:underline"
                        onClick={() => {
                          setCredentialIdInput(String(p.credentialId));
                          void checkCredential(p.credentialId);
                        }}
                      >
                        #{p.credentialId}
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-xs text-muted-foreground">
            Generate credentials as a patient under{" "}
            <Link to="/patient/passport/share" className="text-primary hover:underline">
              Passport → Share
            </Link>
            . Metadata is saved per patient wallet in this browser.
          </p>
        </SectionCard>

        <SectionCard label="Result" title="Credential details">
          {activeId === null ? (
            <p className="text-sm text-muted-foreground">
              Enter a credential id and run an on-chain validity check.
            </p>
          ) : (
            <CredentialDetailPanel
              credentialId={activeId}
              session={sessionForActive}
              onChainValid={onChainValid}
              checking={checking}
            />
          )}
        </SectionCard>
      </div>
    </PageContent>
  );
}
