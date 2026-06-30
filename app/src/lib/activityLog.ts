/** Structured activity log for live integration visibility in the UI. */

export type ActivityLogLevel = "info" | "success" | "warn" | "error";

export interface ActivityLogEntry {
  id: string;
  ts: number;
  level: ActivityLogLevel;
  step: string;
  detail?: string;
  txHash?: string;
  explorerUrl?: string;
}

export interface ActivityLoggerOptions {
  prefix?: string;
  consoleInProduction?: boolean;
}

function consoleEnabled(force?: boolean): boolean {
  if (force) return true;
  return (
    import.meta.env.DEV ||
    import.meta.env.VITE_ACTIVITY_LOG_CONSOLE === "true" ||
    import.meta.env.VITE_SUBMIT_CLAIM_DEBUG === "true" ||
    import.meta.env.VITE_SOROBAN_DEBUG === "true"
  );
}

let entryCounter = 0;

function nextId(): string {
  entryCounter += 1;
  return `log-${entryCounter}`;
}

export function formatActivityData(data: unknown): string | undefined {
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

export function stellarExpertTxUrl(
  hash: string,
  network: "testnet" | "public" = "testnet",
): string {
  return `https://stellar.expert/explorer/${network}/tx/${hash}`;
}

export interface ActivityLogger {
  info(step: string, data?: unknown): void;
  success(step: string, data?: unknown): void;
  warn(step: string, data?: unknown): void;
  error(step: string, err?: unknown): void;
  tx(step: string, hash: string, data?: unknown): void;
  clear(): void;
  getEntries(): ActivityLogEntry[];
}

export function createActivityLogger(
  onEntry: (entry: ActivityLogEntry) => void,
  options: ActivityLoggerOptions = {},
): ActivityLogger {
  const prefix = options.prefix ?? "[ZKlaim]";
  const entries: ActivityLogEntry[] = [];

  function emit(
    level: ActivityLogLevel,
    step: string,
    data?: unknown,
    tx?: { hash: string; explorerUrl?: string },
  ): void {
    const detail = formatActivityData(data);
    const entry: ActivityLogEntry = {
      id: nextId(),
      ts: Date.now(),
      level,
      step,
      detail,
      txHash: tx?.hash,
      explorerUrl: tx?.explorerUrl ?? (tx?.hash ? stellarExpertTxUrl(tx.hash) : undefined),
    };
    entries.push(entry);
    onEntry(entry);

    if (!consoleEnabled(options.consoleInProduction)) return;

    const consoleFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;

    if (detail !== undefined) {
      consoleFn(prefix, step, data);
    } else {
      consoleFn(prefix, step);
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
    tx(step, hash, data) {
      emit("success", step, data, { hash });
    },
    clear() {
      entries.length = 0;
    },
    getEntries() {
      return [...entries];
    },
  };
}
