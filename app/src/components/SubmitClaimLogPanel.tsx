import { useEffect, useRef } from "react";
import type { SubmitClaimLogEntry } from "../lib/submitClaimLog";

interface SubmitClaimLogPanelProps {
  entries: SubmitClaimLogEntry[];
}

const LEVEL_STYLES: Record<SubmitClaimLogEntry["level"], string> = {
  info: "text-slate-300",
  success: "text-emerald-400",
  warn: "text-amber-400",
  error: "text-red-400",
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
    <div className="rounded-lg border border-slate-700 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
        <h4 className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Submit activity log
        </h4>
        <span className="text-xs text-slate-500">
          {entries.length} event{entries.length === 1 ? "" : "s"} · also in
          DevTools console as [ZKlaim Submit]
        </span>
      </div>
      <div className="max-h-64 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {entries.map((entry) => (
          <div key={entry.id} className="leading-relaxed">
            <div className="flex gap-2">
              <span className="shrink-0 text-slate-600">
                {formatTime(entry.ts)}
              </span>
              <span
                className={`shrink-0 uppercase w-14 ${LEVEL_STYLES[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className={`${LEVEL_STYLES[entry.level]} break-words`}>
                {entry.step}
              </span>
            </div>
            {entry.detail && (
              <pre className="mt-1 ml-[5.5rem] whitespace-pre-wrap break-all text-slate-500">
                {entry.detail}
              </pre>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
