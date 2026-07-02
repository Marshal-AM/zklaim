/** Distinguish Node (tests, CLI) from browser main thread and Web Workers. */

export function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions !== null &&
    typeof process.versions.node === "string"
  );
}

/** bb.js thread workers need SharedArrayBuffer (requires COOP/COEP on the page). */
export function isCrossOriginIsolatedBrowser(): boolean {
  return typeof globalThis.crossOriginIsolated === "boolean"
    ? globalThis.crossOriginIsolated
    : false;
}

export function canUseZkProofWorkers(workersRegistered = false): boolean {
  return (
    typeof Worker !== "undefined" &&
    isCrossOriginIsolatedBrowser() &&
    workersRegistered
  );
}

function errorEventDetails(err: object): string | null {
  const ev = err as {
    message?: string;
    filename?: string;
    lineno?: number;
    colno?: number;
  };
  if (
    !("message" in ev || "filename" in ev || "lineno" in ev || "colno" in ev)
  ) {
    return null;
  }
  const parts = [
    ev.message || "Web Worker failed while generating ZK proofs",
    ev.filename
      ? `at ${ev.filename}${ev.lineno ? `:${ev.lineno}` : ""}${ev.colno ? `:${ev.colno}` : ""}`
      : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export function normalizeProverError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === "object") {
    const details = errorEventDetails(err);
    if (details) return new Error(details);
  }
  return new Error(String(err));
}
