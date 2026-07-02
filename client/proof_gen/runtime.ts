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

export function canUseZkProofWorkers(): boolean {
  return typeof Worker !== "undefined" && isCrossOriginIsolatedBrowser();
}

export function normalizeProverError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (err instanceof ErrorEvent) {
    const parts = [
      err.message || "Web Worker failed while generating ZK proofs",
      err.filename ? `at ${err.filename}${err.lineno ? `:${err.lineno}` : ""}` : "",
    ].filter(Boolean);
    return new Error(parts.join(" "));
  }
  return new Error(String(err));
}
