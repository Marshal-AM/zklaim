interface DeductibleBarProps {
  metCents: number;
  limitCents: number;
}

export function DeductibleBar({ metCents, limitCents }: DeductibleBarProps) {
  const pct = Math.min(100, Math.round((metCents / limitCents) * 100));
  const met = metCents >= limitCents;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-slate-400">Annual deductible</span>
        <span className={met ? "text-emerald-400 font-medium" : "text-slate-300"}>
          {met ? "Met — insurer covers 100%" : `${pct}% toward threshold`}
        </span>
      </div>
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all ${met ? "bg-emerald-500" : "bg-sky-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-500">
        Progress tracked privately — individual claim amounts are never shown here.
      </p>
    </div>
  );
}
