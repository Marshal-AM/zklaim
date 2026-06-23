import { useEffect, useRef } from "react";
import type { SubmitClaimLogEntry } from "../lib/submitClaimLog";

interface SubmitClaimLogPanelProps {
  entries: SubmitClaimLogEntry[];
}

const LEVEL_STYLES: Record<SubmitClaimLogEntry["level"], string> = {
  info: "text-foreground/75",
  success: "text-success",
  warn: "text-primary",
  error: "text-destructive",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SubmitClaimLogPanel({ entries }: SubmitClaimLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div className="card-shell overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <h4 className="ml-2 section-label">Submit activity log</h4>
        <span className="ml-auto text-[10px] text-subtle">
          {entries.length} event{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto p-3 font-mono text-[11px] leading-[1.45]">
        {entries.map((entry) => (
          <div key={entry.id}>
            <div className="flex gap-2">
              <span className="shrink-0 text-subtle">{formatTime(entry.ts)}</span>
              <span
                className={`w-14 shrink-0 uppercase ${LEVEL_STYLES[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className={`break-words ${LEVEL_STYLES[entry.level]}`}>
                {entry.step}
              </span>
            </div>
            {entry.detail ? (
              <pre className="ml-[5.5rem] mt-1 whitespace-pre-wrap break-all text-subtle">
                {entry.detail}
              </pre>
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
