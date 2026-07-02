import type { ActivityLogEntry, ActivityLogLevel } from "./activityLog";

export interface ActivityLogSummary {
  total: number;
  durationMs: number | null;
  byLevel: Record<ActivityLogLevel, number>;
  errors: ActivityLogEntry[];
  successes: ActivityLogEntry[];
  txHashes: string[];
  headline: string;
}

export function summarizeActivityLog(
  entries: ActivityLogEntry[],
): ActivityLogSummary {
  const byLevel: Record<ActivityLogLevel, number> = {
    info: 0,
    success: 0,
    warn: 0,
    error: 0,
  };

  const errors: ActivityLogEntry[] = [];
  const successes: ActivityLogEntry[] = [];
  const txHashes: string[] = [];

  for (const entry of entries) {
    byLevel[entry.level] += 1;
    if (entry.level === "error") errors.push(entry);
    if (entry.level === "success") successes.push(entry);
    if (entry.txHash && !txHashes.includes(entry.txHash)) {
      txHashes.push(entry.txHash);
    }
  }

  const durationMs =
    entries.length >= 2
      ? entries[entries.length - 1]!.ts - entries[0]!.ts
      : entries.length === 1
        ? 0
        : null;

  const lastError = errors[errors.length - 1];
  const lastSuccess = successes[successes.length - 1];
  const headline = lastError
    ? lastError.step
    : lastSuccess
      ? lastSuccess.step
      : entries.length > 0
        ? entries[entries.length - 1]!.step
        : "No activity recorded";

  return {
    total: entries.length,
    durationMs,
    byLevel,
    errors,
    successes,
    txHashes,
    headline,
  };
}
