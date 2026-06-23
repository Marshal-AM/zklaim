/** Console + UI logging for the patient Submit Claim flow. */

const PREFIX = "[ZKlaim Submit]";

export type SubmitClaimLogLevel = "info" | "success" | "warn" | "error";

export interface SubmitClaimLogEntry {
  id: string;
  ts: number;
  level: SubmitClaimLogLevel;
  step: string;
  detail?: string;
}

function consoleEnabled(): boolean {
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_SUBMIT_CLAIM_DEBUG === "true" ||
    import.meta.env.VITE_SOROBAN_DEBUG === "true"
  );
}

let entryCounter = 0;

function nextId(): string {
  entryCounter += 1;
  return `submit-${entryCounter}`;
}

export function formatSubmitClaimData(data: unknown): string | undefined {
  if (data === undefined) return undefined;
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(
      data,
      (_, value) => (typeof value === "bigint" ? value.toString() : value),
      2,
    );
  } catch {
    return String(data);
  }
}

export interface SubmitClaimLogger {
  info(step: string, data?: unknown): void;
  success(step: string, data?: unknown): void;
  warn(step: string, data?: unknown): void;
  error(step: string, err?: unknown): void;
  clear(): void;
  getEntries(): SubmitClaimLogEntry[];
}

export function createSubmitClaimLogger(
  onEntry: (entry: SubmitClaimLogEntry) => void,
): SubmitClaimLogger {
  const entries: SubmitClaimLogEntry[] = [];

  function emit(level: SubmitClaimLogLevel, step: string, data?: unknown): void {
    const detail = formatSubmitClaimData(data);
    const entry: SubmitClaimLogEntry = {
      id: nextId(),
      ts: Date.now(),
      level,
      step,
      detail,
    };
    entries.push(entry);
    onEntry(entry);

    if (!consoleEnabled()) return;

    const consoleFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    if (detail !== undefined) {
      consoleFn(PREFIX, step, data);
    } else {
      consoleFn(PREFIX, step);
    }
  }

  return {
    info(step, data) {
      emit("info", step, data);
    },
    success(step, data) {
      emit("success", step, data);
    },
    warn(step, data) {
      emit("warn", step, data);
    },
    error(step, err) {
      const data =
        err instanceof Error
          ? { message: err.message, name: err.name, stack: err.stack }
          : err;
      emit("error", step, data);
    },
    clear() {
      entries.length = 0;
    },
    getEntries() {
      return [...entries];
    },
  };
}
