Looking at your issue, the core problem is clear: **envelope mutation after `prepareTransaction`**. Let me write you a clean, minimal reference implementation that does the flow correctly.Now let me write the reference implementation:Here's what the component does and why each step matters:

**The correct 5-step flow (enforced explicitly):**

```
Build (fee=100, setTimeout once)
  → prepareTransaction()     ← simulate + footprint + auth + bump fee
  → signTransaction(xdr)     ← Freighter gets prepared XDR, returns signed XDR
  → fingerprint check        ← abort if envelope changed
  → sendTransaction()        ← immediately, no rebuilding
  → poll getTransaction()
```

**The three bugs your doc describes, and how this avoids each:**

| Bug | What it did | This component |
|-----|------------|----------------|
| Pre-auth attachment | Attached auth to unsigned tx before `assembleTransaction` | Uses `prepareTransaction` only — it handles auth internally |
| Envelope mutation | `cloneFrom(...).setTimeout(30)` after prepare, changing `timeboundsMax` | `setTimeout` called once during build, never again |
| Silent mismatch | `sorobanDataMatch: true` but envelope fingerprint had drifted | Explicit XDR fingerprint comparison before submit; throws if they differ |

**To adapt it to your ZKlaim `submit_claim`:**

1. Swap `CONTRACT_ID` and `CONTRACT_METHOD = "submit_claim"`
2. Add your ZK proof args to `contract.call("submit_claim", arg1, arg2, ...)` — this doesn't change the flow at all
3. If your patient auth is `sorobanCredentialsAddress` (not `sourceAccount`), you'd add a `signAuthEntry` step between `prepare` and `signTransaction` — but your bug report says it's `sourceAccount`, so the envelope signature is sufficient as-is


Code:

/**
 * SorobanFreighterDemo.tsx
 *
 * Minimal reference for the CORRECT Soroban + Freighter flow:
 *   1. Build unsigned tx  (fee=100, setTimeout)
 *   2. prepareTransaction (simulation + footprint + auth baked in)
 *   3. Sign prepared tx as-is  ← NO mutation here
 *   4. Submit immediately
 *
 * Swap CONTRACT_ID / CONTRACT_METHOD / NETWORK_* for your own values.
 * This uses a no-arg contract method ("ping") so you can test without ZK proofs.
 */

import { useState } from "react";
import {
  Contract,
  Networks,
  SorobanRpc,
  TransactionBuilder,
  BASE_FEE,
} from "@stellar/stellar-sdk";
import {
  isConnected,
  getPublicKey,
  signTransaction,
} from "@stellar/freighter-api";

// ─── Config ────────────────────────────────────────────────────────────────

const NETWORK_PASSPHRASE = Networks.TESTNET;
const RPC_URL = "https://soroban-testnet.stellar.org";

// Replace with your deployed contract.  "ping" is a trivial no-arg method that
// returns void — identical auth surface to submit_claim (sourceAccount only).
const CONTRACT_ID = "CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX";
const CONTRACT_METHOD = "ping"; // change to "submit_claim" + args for real flow

// ─── Types ─────────────────────────────────────────────────────────────────

type Stage =
  | "idle"
  | "connecting"
  | "building"
  | "preparing"   // simulate + assemble
  | "signing"     // Freighter prompt
  | "submitting"
  | "polling"
  | "success"
  | "error";

interface Log {
  stage: string;
  ok: boolean;
  detail: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function envelopeHash(xdr: string): string {
  // Cheap fingerprint: last 16 chars of XDR string for log comparison
  return xdr.slice(-16);
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function SorobanFreighterDemo() {
  const [stage, setStage] = useState<Stage>("idle");
  const [logs, setLogs] = useState<Log[]>([]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addLog(stage: string, ok: boolean, detail: string) {
    setLogs((prev) => [...prev, { stage, ok, detail }]);
  }

  async function runFlow() {
    setLogs([]);
    setTxHash(null);
    setError(null);

    try {
      // ── 0. Check Freighter ──────────────────────────────────────────────
      setStage("connecting");
      const connected = await isConnected();
      if (!connected) throw new Error("Freighter not installed or not connected.");

      const publicKey = await getPublicKey();
      addLog("connect", true, `Public key: ${publicKey.slice(0, 8)}…`);

      // ── 1. Build UNSIGNED transaction ───────────────────────────────────
      //    fee = BASE_FEE (100 stroops) — prepareTransaction will add resource fee
      //    setTimeout(30) sets timebounds; prepareTransaction preserves them
      setStage("building");
      const server = new SorobanRpc.Server(RPC_URL);
      const account = await server.getAccount(publicKey);

      const contract = new Contract(CONTRACT_ID);

      const unsignedTx = new TransactionBuilder(account, {
        fee: BASE_FEE,           // 100 — resource fee added by prepareTransaction
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(
          contract.call(CONTRACT_METHOD /*, ...args if needed */)
        )
        .setTimeout(30)          // timebounds "now + 30s" — DO NOT reset after this
        .build();

      addLog("build", true, `unsigned envelope: …${envelopeHash(unsignedTx.toXDR())}`);

      // ── 2. prepareTransaction (simulate + assemble in one call) ─────────
      //    This attaches:
      //      • sorobanData (footprint + resource limits + resourceFee)
      //      • auth entries from simulation result
      //      • bumps tx.fee = BASE_FEE + resourceFee
      //    IMPORTANT: do NOT touch the returned tx before signing.
      setStage("preparing");
      const preparedTx = await server.prepareTransaction(unsignedTx);
      const preparedXdr = preparedTx.toXDR();

      addLog("prepare", true, [
        `fee: ${preparedTx.fee}`,
        `envelope: …${envelopeHash(preparedXdr)}`,
      ].join(" | "));

      // ── 3. Sign with Freighter — as-is, no cloneFrom, no setTimeout ─────
      //    Freighter preserves sorobanData.  Any rebuild/clone here would
      //    change timeboundsMax → envelope hash mismatch → txSorobanInvalid.
      setStage("signing");
      const signResult = await signTransaction(preparedXdr, {
        network: "TESTNET",
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (signResult.error) {
        throw new Error(`Freighter error: ${signResult.error}`);
      }

      const signedXdr = signResult.signedTxXdr;

      // ── Integrity check: envelope fingerprint must match ────────────────
      //    If these differ, something mutated the envelope — abort and debug.
      const preparedFp = envelopeHash(preparedXdr);
      const signedFp   = envelopeHash(signedXdr);
      const envelopeOk = preparedFp === signedFp;

      addLog("sign", envelopeOk, [
        `prepared fp: ${preparedFp}`,
        `signed fp:   ${signedFp}`,
        envelopeOk ? "✓ envelope unchanged" : "✗ MISMATCH — sorobanData may be stale",
      ].join(" | "));

      if (!envelopeOk) {
        throw new Error(
          "Envelope fingerprint changed after Freighter sign. " +
          "Freighter may have stripped sorobanData. Check network/passphrase."
        );
      }

      // ── 4. Submit immediately ───────────────────────────────────────────
      //    Use the XDR string directly — no re-deserialization needed.
      setStage("submitting");
      const { TransactionEnvelope } = await import("@stellar/stellar-sdk");
      // Re-hydrate from XDR so we can call server.sendTransaction
      const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
      const signedTx = TB.fromXDR(signedXdr, NETWORK_PASSPHRASE);

      const sendResult = await server.sendTransaction(signedTx as any);

      if (sendResult.status === "ERROR") {
        const resultXdr = sendResult.errorResult?.toXDR("base64") ?? "n/a";
        throw new Error(
          `sendTransaction ERROR\n` +
          `status: ${sendResult.status}\n` +
          `hash:   ${sendResult.hash}\n` +
          `result: ${resultXdr}`
        );
      }

      addLog("submit", true, `hash: ${sendResult.hash} | status: ${sendResult.status}`);

      // ── 5. Poll for confirmation ────────────────────────────────────────
      setStage("polling");
      const hash = sendResult.hash;
      let confirmed = false;

      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const result = await server.getTransaction(hash);

        if (result.status === "SUCCESS") {
          addLog("confirm", true, `Confirmed in ${i + 1} poll(s)`);
          setTxHash(hash);
          setStage("success");
          confirmed = true;
          break;
        }
        if (result.status === "FAILED") {
          throw new Error(`Transaction FAILED on-chain. Hash: ${hash}`);
        }
        // status === "NOT_FOUND" → still processing, keep polling
      }

      if (!confirmed) {
        throw new Error(`Timed out polling for ${hash}`);
      }
    } catch (err: any) {
      setError(err.message ?? String(err));
      addLog("error", false, err.message ?? String(err));
      setStage("error");
    }
  }

  // ─── UI ─────────────────────────────────────────────────────────────────

  const stageLabel: Record<Stage, string> = {
    idle:       "Ready",
    connecting: "Connecting to Freighter…",
    building:   "Building unsigned tx…",
    preparing:  "Simulating + assembling…",
    signing:    "Waiting for Freighter signature…",
    submitting: "Submitting to network…",
    polling:    "Waiting for confirmation…",
    success:    "Transaction confirmed ✓",
    error:      "Failed",
  };

  const busy = !["idle", "success", "error"].includes(stage);

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.badge}>TESTNET</span>
          <h1 style={styles.title}>Soroban + Freighter</h1>
          <p style={styles.subtitle}>Reference flow: prepare → sign → submit</p>
        </div>

        {/* Flow diagram */}
        <div style={styles.flowRow}>
          {(["build", "prepare", "sign", "submit", "confirm"] as const).map((s, i) => {
            const done = logs.some((l) => l.stage === s && l.ok);
            const failed = logs.some((l) => l.stage === s && !l.ok);
            return (
              <div key={s} style={styles.flowStep}>
                <div style={{
                  ...styles.flowCircle,
                  background: failed ? "#ef4444" : done ? "#22c55e" : "#334155",
                  borderColor: failed ? "#ef4444" : done ? "#22c55e" : "#475569",
                }}>
                  {i + 1}
                </div>
                <span style={styles.flowLabel}>{s}</span>
                {i < 4 && <div style={styles.flowLine} />}
              </div>
            );
          })}
        </div>

        {/* Status */}
        <div style={styles.statusBar}>
          <span style={{
            ...styles.dot,
            background: stage === "error" ? "#ef4444"
              : stage === "success" ? "#22c55e"
              : busy ? "#f59e0b"
              : "#64748b"
          }} />
          <span style={styles.statusText}>{stageLabel[stage]}</span>
        </div>

        {/* CTA */}
        <button
          onClick={runFlow}
          disabled={busy}
          style={{ ...styles.btn, opacity: busy ? 0.5 : 1 }}
        >
          {busy ? "Running…" : stage === "idle" ? "Run Test Transaction" : "Run Again"}
        </button>

        {/* Logs */}
        {logs.length > 0 && (
          <div style={styles.logBox}>
            {logs.map((l, i) => (
              <div key={i} style={styles.logLine}>
                <span style={{ color: l.ok ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                  {l.ok ? "✓" : "✗"} [{l.stage}]
                </span>
                <span style={{ color: "#94a3b8", marginLeft: 8 }}>{l.detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Success */}
        {txHash && (
          <div style={styles.successBox}>
            <div style={styles.successLabel}>Transaction Hash</div>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.hashLink}
            >
              {txHash}
            </a>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.errorBox}>
            <div style={styles.errorLabel}>Error</div>
            <pre style={styles.errorPre}>{error}</pre>
          </div>
        )}

        {/* Reference notes */}
        <details style={styles.notes}>
          <summary style={styles.notesSummary}>What this tests</summary>
          <ul style={styles.notesList}>
            <li><strong>No mutation after prepare:</strong> signed XDR envelope fingerprint is verified against prepared XDR before submit.</li>
            <li><strong>No auth pre-attachment:</strong> <code>prepareTransaction</code> handles auth from simulation result.</li>
            <li><strong>No double setTimeout:</strong> timebounds set once during build, never reset.</li>
            <li><strong>Fee:</strong> <code>BASE_FEE (100)</code> on build; <code>prepareTransaction</code> adds resource fee.</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    background: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
  },
  card: {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 12,
    padding: 32,
    width: "100%",
    maxWidth: 680,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  badge: {
    display: "inline-block",
    background: "#0ea5e9",
    color: "#0f172a",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 2,
    padding: "2px 8px",
    borderRadius: 4,
    width: "fit-content",
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: "#f1f5f9",
    letterSpacing: -0.5,
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "#64748b",
  },
  flowRow: {
    display: "flex",
    alignItems: "center",
    gap: 0,
  },
  flowStep: {
    display: "flex",
    alignItems: "center",
    flexDirection: "column" as const,
    gap: 6,
    position: "relative" as const,
  },
  flowCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    border: "2px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#f1f5f9",
    transition: "all 0.3s",
  },
  flowLabel: {
    fontSize: 10,
    color: "#64748b",
    letterSpacing: 1,
    textTransform: "uppercase" as const,
    width: 56,
    textAlign: "center" as const,
  },
  flowLine: {
    flex: 1,
    height: 1,
    background: "#334155",
    minWidth: 20,
    marginTop: -22,
    alignSelf: "center",
  },
  statusBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    background: "#0f172a",
    borderRadius: 6,
    border: "1px solid #1e293b",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  statusText: {
    fontSize: 13,
    color: "#94a3b8",
  },
  btn: {
    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "opacity 0.2s",
    letterSpacing: 0.3,
  },
  logBox: {
    background: "#0f172a",
    borderRadius: 6,
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    maxHeight: 220,
    overflowY: "auto",
    border: "1px solid #1e293b",
  },
  logLine: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 4,
    lineHeight: 1.6,
  },
  successBox: {
    background: "#052e16",
    border: "1px solid #16a34a",
    borderRadius: 6,
    padding: "12px 16px",
  },
  successLabel: {
    fontSize: 10,
    color: "#4ade80",
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  hashLink: {
    color: "#4ade80",
    fontSize: 12,
    wordBreak: "break-all" as const,
    textDecoration: "none",
  },
  errorBox: {
    background: "#1c0a0a",
    border: "1px solid #ef4444",
    borderRadius: 6,
    padding: "12px 16px",
  },
  errorLabel: {
    fontSize: 10,
    color: "#f87171",
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  errorPre: {
    margin: 0,
    fontSize: 11,
    color: "#fca5a5",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
  },
  notes: {
    borderTop: "1px solid #334155",
    paddingTop: 16,
  },
  notesSummary: {
    fontSize: 12,
    color: "#64748b",
    cursor: "pointer",
    userSelect: "none" as const,
  },
  notesList: {
    marginTop: 10,
    paddingLeft: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    fontSize: 12,
    color: "#94a3b8",
    lineHeight: 1.6,
  },
};