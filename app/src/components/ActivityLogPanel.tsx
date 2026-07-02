import { useEffect, useRef } from "react";
import type { ActivityLogEntry } from "../lib/activityLog";

interface ActivityLogPanelProps {
  entries: ActivityLogEntry[];
  title?: string;
  emptyMessage?: string;
  className?: string;
  autoScroll?: boolean;
}

const LEVEL_STYLES: Record<ActivityLogEntry["level"], string> = {
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

export function ActivityLogPanel({
  entries,
  title = "Activity log",
  emptyMessage,
  className = "",
  autoScroll = true,
}: ActivityLogPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoScroll) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries.length, autoScroll]);

  if (entries.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className={`card-shell p-3 text-xs text-muted-foreground ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={`card-shell overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-red-400/70" />
        <span className="h-2 w-2 rounded-full bg-amber-400/70" />
        <span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <h4 className="ml-2 section-label">{title}</h4>
        <span className="ml-auto text-[10px] text-subtle">
          {entries.length} event{entries.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="max-h-96 space-y-2 overflow-y-auto p-3 font-mono text-[11px] leading-[1.45]">
        {entries.map((entry) => (
          <div key={entry.id}>
            <div className="flex gap-2">
              <span className="shrink-0 text-subtle">{formatTime(entry.ts)}</span>
              <span
                className={`w-14 shrink-0 uppercase ${LEVEL_STYLES[entry.level]}`}
              >
                {entry.level}
              </span>
              <span className={`min-w-0 break-words ${LEVEL_STYLES[entry.level]}`}>
                {entry.step}
              </span>
            </div>
            {entry.txHash && entry.explorerUrl ? (
              <a
                href={entry.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="ml-[5.5rem] mt-1 block text-safe-mono text-[10px] text-primary underline"
              >
                tx {entry.txHash}
              </a>
            ) : null}
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
