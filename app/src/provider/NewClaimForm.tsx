import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { computeClaimHash, fieldFromHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../lib/walletSession";
import { useProviderEnrollment } from "../components/ProviderRegistration";
import { QrDisplay } from "../components/QrDisplay";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/ui/FormField";
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
import {
  DEMO_DEFAULT_AMOUNT_USD,
  DEMO_POLICY_CEILING_CENTS,
  DEMO_POLICY_FLOOR_CENTS,
  formatDemoPolicyRange,
} from "../config/demoPolicy";

interface PolicyLeaf {
  icd_code: string;
}

export function NewClaimForm() {
  const address = useWalletStore((s) => s.address);
  const addHistory = useProviderStore((s) => s.addHistory);
  const { enrolled, physician } = useProviderEnrollment(address);
  const [icdCodes, setIcdCodes] = useState<string[]>([]);
  const [patientAddress, setPatientAddress] = useState("");
  const [patientBoxKey, setPatientBoxKey] = useState("");
  const [icdCode, setIcdCode] = useState("J18.9");
  const [amount, setAmount] = useState(DEMO_DEFAULT_AMOUNT_USD);
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<{
    deepLink: string;
    cid: string;
    supabaseDelivered: boolean;
  } | null>(null);

  const supabaseEnabled = env.isSupabaseEnabled();

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
      const visitNum = parseInt(visitDate, 10);

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
      console.log("[ZKlaim Provider] signing claim payload", {
        doctorAddress,
        payloadBytes: canonical.length,
        preview: canonical.slice(0, 120),
      });

      const signature = await freighterSignMessage(canonical, doctorAddress);

      const payload: ClaimTokenPayload = {
        ...base,
        doctor_signature: signature,
      };

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

      const claimHash = await computeClaimHash({
        visitDate: visitNum,
        policyId: payload.policy_id,
        nonce: fieldFromHex(nonce),
      });
      const entry = {
        claim_hash: claimHash.toString(16),
        date: new Date().toISOString(),
        patientAddress: patientStellar,
      };
      addHistory(entry);
      const hist = await loadProviderHistory();
      await saveProviderHistory([entry, ...hist]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create claim");
    } finally {
      setBusy(false);
    }
  }

  if (delivery) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-[650] tracking-tight">Claim sent to patient</h3>
        {delivery.supabaseDelivered ? (
          <div className="success-card px-4 py-3 text-sm text-success">
            Claim delivered to the patient&apos;s inbox automatically.
          </div>
        ) : null}
        <QrDisplay
          value={delivery.deepLink}
          label="Patient can also open this link"
        />
        <p className="break-all font-mono text-xs text-subtle">
          IPFS CID commitment: {delivery.cid}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Credential: {physician?.license_id} ({physician?.specialty_code})
        </p>
        <Link
          to="/provider/register"
          className="text-xs font-medium text-primary hover:underline"
        >
          Change credential
        </Link>
      </div>
      <FormField
        label="Patient Stellar address"
        hint={
          supabaseEnabled
            ? "Encryption key is looked up from the ZKlaim directory."
            : undefined
        }
      >
        <input
          required
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          className="input-field font-mono"
          placeholder="G…"
        />
      </FormField>
      {!supabaseEnabled ? (
        <FormField label="Patient encryption key">
          <input
            required
            value={patientBoxKey}
            onChange={(e) => setPatientBoxKey(e.target.value)}
            className="input-field font-mono text-xs"
            placeholder="From patient portal"
          />
        </FormField>
      ) : null}
      <FormField label="ICD-10 code">
        <input
          list="icd-list"
          required
          value={icdCode}
          onChange={(e) => setIcdCode(e.target.value)}
          className="input-field"
        />
        <datalist id="icd-list">
          {icdCodes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </FormField>
      <FormField label="Visit date (YYYYMMDD)">
        <input
          required
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          className="input-field font-mono"
        />
      </FormField>
      <FormField
        label="Billed amount (USD)"
        hint={`Demo policy range: ${formatDemoPolicyRange()}`}
      >
        <input
          required
          type="number"
          min={DEMO_POLICY_FLOOR_CENTS / 100}
          max={DEMO_POLICY_CEILING_CENTS / 100}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input-field"
        />
      </FormField>
      <button
        type="submit"
        disabled={busy || !enrolled}
        className="btn-primary w-full"
      >
        {busy ? "Signing…" : "Sign & Send to Patient"}
      </button>
    </form>
  );
}
