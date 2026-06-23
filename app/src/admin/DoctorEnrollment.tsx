import { useState } from "react";
import { ensureWalletConnected } from "../components/WalletButton";
import { ErrorBanner } from "../components/ErrorBanner";
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
      {error && <ErrorBanner message={error} />}
      {txHash && (
        <p className="text-xs text-emerald-400">
          Tx:{" "}
          <a
            href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {txHash.slice(0, 16)}…
          </a>
        </p>
      )}
      <input
        required
        placeholder="license_hash (hex)"
        value={licenseHash}
        onChange={(e) => setLicenseHash(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
      />
      <input
        required
        placeholder="specialty_code"
        value={specialty}
        onChange={(e) => setSpecialty(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="jurisdiction_hash (hex)"
        value={jurisdiction}
        onChange={(e) => setJurisdiction(e.target.value)}
        className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-mono"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-4 py-2 rounded bg-slate-700 hover:bg-slate-600 text-sm"
      >
        enroll_doctor
      </button>
    </form>
  );
}
