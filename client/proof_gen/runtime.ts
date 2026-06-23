/** Distinguish Node (tests, CLI) from browser main thread and Web Workers. */

export function isNodeRuntime(): boolean {
  return (
    typeof process !== "undefined" &&
    typeof process.versions === "object" &&
    process.versions !== null &&
    typeof process.versions.node === "string"
  );
}
