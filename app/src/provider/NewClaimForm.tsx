import { useEffect, useState } from "react";
import { computeClaimHash, fieldFromHex } from "@zklaim/scripts";
import { ensureWalletConnected } from "../components/WalletButton";
import { useProviderEnrollment } from "../components/ProviderRegistration";
import { QrDisplay } from "../components/QrDisplay";
import { ErrorBanner } from "../components/ErrorBanner";
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
    if (supabaseEnabled) {
      const key = await lookupBoxPublicKey(patientAddress.trim());
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
        patientAddress: patientAddress.trim(),
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
          patientAddress: patientAddress.trim(),
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
        patientAddress: patientAddress.trim(),
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
        <h3 className="font-medium text-lg">Claim sent to patient</h3>
        {delivery.supabaseDelivered ? (
          <p className="text-sm text-emerald-400">
            Claim delivered to the patient&apos;s inbox automatically.
          </p>
        ) : null}
        <QrDisplay
          value={delivery.deepLink}
          label="Patient can also open this link"
        />
        <p className="text-xs text-slate-500 font-mono break-all">
          IPFS CID commitment: {delivery.cid}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <ErrorBanner message={error} />}
      <p className="text-xs text-slate-500">
        Credential: {physician?.license_id} ({physician?.specialty_code})
      </p>
      <label className="block text-sm space-y-1">
        <span className="text-slate-400">Patient Stellar address</span>
        <input
          required
          value={patientAddress}
          onChange={(e) => setPatientAddress(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
          placeholder="G…"
        />
        {supabaseEnabled ? (
          <span className="text-xs text-slate-500">
            Encryption key is looked up from the ZKlaim directory.
          </span>
        ) : null}
      </label>
      {!supabaseEnabled ? (
        <label className="block text-sm space-y-1">
          <span className="text-slate-400">Patient encryption key</span>
          <input
            required
            value={patientBoxKey}
            onChange={(e) => setPatientBoxKey(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono text-xs"
            placeholder="From patient portal"
          />
        </label>
      ) : null}
      <label className="block text-sm space-y-1">
        <span className="text-slate-400">ICD-10 code</span>
        <input
          list="icd-list"
          required
          value={icdCode}
          onChange={(e) => setIcdCode(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <datalist id="icd-list">
          {icdCodes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <label className="block text-sm space-y-1">
        <span className="text-slate-400">Visit date (YYYYMMDD)</span>
        <input
          required
          value={visitDate}
          onChange={(e) => setVisitDate(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm space-y-1">
        <span className="text-slate-400">Billed amount (USD)</span>
        <input
          required
          type="number"
          min={DEMO_POLICY_FLOOR_CENTS / 100}
          max={DEMO_POLICY_CEILING_CENTS / 100}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
        />
        <span className="text-xs text-slate-500">
          Demo policy range: {formatDemoPolicyRange()}
        </span>
      </label>
      <button
        type="submit"
        disabled={busy || !enrolled}
        className="w-full py-2 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium"
      >
        {busy ? "Signing…" : "Sign & Send to Patient"}
      </button>
    </form>
  );
}
