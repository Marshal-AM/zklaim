import { useState } from "react";
import { ensureWalletConnected } from "../lib/walletSession";
import { ErrorBanner } from "../components/ErrorBanner";
import { FormField } from "../components/ui/FormField";
import { enrollDoctor } from "../lib/contracts";

export function DoctorEnrollment() {
  const [licenseHash, setLicenseHash] = useState("");
  const [specialty, setSpecialty] = useState("PULM");
  const [jurisdiction, setJurisdiction] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const admin = await ensureWalletConnected();
      const result = await enrollDoctor({
        admin,
        licenseHash: licenseHash.replace(/^0x/, ""),
        specialtyCode: specialty,
        jurisdictionHash: jurisdiction.replace(/^0x/, ""),
      });
      setTxHash(result.hash);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error ? <ErrorBanner message={error} /> : null}
      {txHash ? (
        <div className="success-card px-4 py-3 text-xs">
          Tx:{" "}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-success underline"
          >
            {txHash.slice(0, 16)}…
          </a>
        </div>
      ) : null}
      <FormField label="License hash (hex)">
        <input
          required
          value={licenseHash}
          onChange={(e) => setLicenseHash(e.target.value)}
          className="input-field font-mono"
          placeholder="license_hash"
        />
      </FormField>
      <FormField label="Specialty code">
        <input
          required
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="input-field"
          placeholder="PULM"
        />
      </FormField>
      <FormField label="Jurisdiction hash (hex)">
        <input
          required
          value={jurisdiction}
          onChange={(e) => setJurisdiction(e.target.value)}
          className="input-field font-mono"
          placeholder="jurisdiction_hash"
        />
      </FormField>
      <button type="submit" disabled={busy} className="btn-secondary">
        enroll_doctor
      </button>
    </form>
  );
}
