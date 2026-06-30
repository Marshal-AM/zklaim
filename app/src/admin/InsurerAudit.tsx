import { useCallback, useMemo, useState } from "react";
import { env } from "../config/env";
import { FormField } from "../components/ui/FormField";
import { DetailList, DetailRow } from "../components/ui/DetailList";
import { ActivityLogPanel } from "../components/ActivityLogPanel";
import { createActivityLogger, type ActivityLogEntry } from "../lib/activityLog";
import { parseClaimTokenInput } from "../lib/parseClaimTokenInput";
import type { ClaimTokenPayload } from "../lib/claimToken";
import { decryptInsurerView } from "../lib/viewKey";
import { formatVisitDate } from "../lib/claimInbox";
import { formatUsdc } from "../lib/balances";
import { toast } from "../lib/toast";

export function InsurerAudit() {
  const [tokenInput, setTokenInput] = useState("");
  const [secretInput, setSecretInput] = useState(
    () => import.meta.env.VITE_INSURER_VIEW_SECRET_KEY ?? "",
  );
  const [decrypted, setDecrypted] = useState<ClaimTokenPayload | null>(null);
  const [logEntries, setLogEntries] = useState<ActivityLogEntry[]>([]);

  const appendLog = useCallback((e: ActivityLogEntry) => {
    setLogEntries((prev) => [...prev, e]);
  }, []);
  const log = useMemo(
    () => createActivityLogger(appendLog, { prefix: "[ZKlaim Insurer]" }),
    [appendLog],
  );

  const publicKeyConfigured = env.hasInsurerViewKey();
  const secretFromEnv = Boolean(import.meta.env.VITE_INSURER_VIEW_SECRET_KEY);

  function handleDecrypt() {
    setLogEntries([]);
    log.clear();
    setDecrypted(null);

    log.info("Parsing claim token input…");
    try {
      const token = parseClaimTokenInput(tokenInput);
      log.success("Token parsed", {
        content_address: token.cid,
        has_insurer_view: Boolean(token.insurer_view),
        has_patient_ciphertext: Boolean(token.ciphertext),
      });

      if (!token.insurer_view) {
        throw new Error(
          "This token has no insurer_view envelope. Create a new claim after setting VITE_INSURER_VIEW_PUBLIC_KEY and restarting the dev server.",
        );
      }

      const secret = secretInput.trim();
      if (!secret) {
        throw new Error(
          "Enter the insurer view secret key, or set VITE_INSURER_VIEW_SECRET_KEY in .env.",
        );
      }

      log.info("Decrypting insurer view envelope (off-chain selective disclosure)…");
      const json = decryptInsurerView(token.insurer_view, secret);
      const payload = JSON.parse(json) as ClaimTokenPayload;
      setDecrypted(payload);
      log.success("Claim decrypted for insurer audit", {
        icd_code: payload.icd_code,
        amount_cents: payload.amount_cents,
        patientAddress: payload.patientAddress,
      });
      toast.success("Insurer view decrypted — details below are off-chain only.");
    } catch (err) {
      log.error("Insurer audit decrypt failed", err);
      toast.error(err instanceof Error ? err.message : "Decrypt failed");
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface-row space-y-2 p-3 text-xs text-muted-foreground">
        <p>
          <span className="font-[650] text-foreground">Selective disclosure:</span>{" "}
          decrypt the insurer copy of a claim. On-chain settlement still shows only
          nullifier + USDC — not this data.
        </p>
        <p>
          Public key configured:{" "}
          <span className={publicKeyConfigured ? "text-success" : "text-primary"}>
            {publicKeyConfigured ? "yes" : "no — set VITE_INSURER_VIEW_PUBLIC_KEY"}
          </span>
          {" · "}
          Secret in env:{" "}
          <span className={secretFromEnv ? "text-success" : "text-muted-foreground"}>
            {secretFromEnv ? "yes (demo)" : "paste below"}
          </span>
        </p>
      </div>

      <FormField
        label="Encrypted claim token"
        hint="Paste JSON from provider “Copy for insurer audit”, or a patient deep link URL."
      >
        <textarea
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          className="input-field min-h-[120px] font-mono text-xs"
          placeholder='{"version":1,"ephemeralPublicKey":"...","insurer_view":{...}}'
        />
      </FormField>

      <FormField
        label="Insurer view secret key (base64)"
        hint="Demo: auto-filled from VITE_INSURER_VIEW_SECRET_KEY when set."
      >
        <textarea
          value={secretInput}
          onChange={(e) => setSecretInput(e.target.value)}
          className="input-field min-h-[64px] font-mono text-xs"
          placeholder="Base64 NaCl secret key"
        />
      </FormField>

      <button
        type="button"
        onClick={handleDecrypt}
        className="btn-primary w-full py-2.5"
        disabled={!tokenInput.trim()}
      >
        Decrypt insurer view
      </button>

      {decrypted ? (
        <div className="success-card space-y-3 p-4 text-sm">
          <p className="section-label">Decrypted claim (insurer view only)</p>
          <DetailList>
            <DetailRow term="Patient" value={decrypted.patientAddress} mono />
            <DetailRow term="ICD-10" value={decrypted.icd_code} />
            <DetailRow
              term="Amount"
              value={formatUsdc(decrypted.amount_cents)}
            />
            <DetailRow
              term="Visit"
              value={formatVisitDate(decrypted.visit_date)}
            />
            <DetailRow term="Policy" value={decrypted.policy_id} />
            <DetailRow term="Doctor license" value={decrypted.doctor_license_id} />
            <DetailRow term="Doctor address" value={decrypted.doctor_address} mono />
          </DetailList>
        </div>
      ) : null}

      <ActivityLogPanel entries={logEntries} title="Insurer audit log" />
    </div>
  );
}
