interface DeductibleBarProps {
  metCents: number;
  limitCents: number;
}

export function DeductibleBar({ metCents, limitCents }: DeductibleBarProps) {
  const pct = Math.min(100, Math.round((metCents / limitCents) * 100));
  const met = metCents >= limitCents;

  return (
    <div className="card-padded space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="section-label">Annual deductible</p>
        <span
          className={
            met
              ? "badge-success"
              : "badge-primary"
          }
        >
          {met ? "Met — 100% covered" : `${pct}% toward threshold`}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full transition-fluid ${met ? "bg-success" : "bg-primary"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Progress tracked privately — individual claim amounts are never shown
        here.
      </p>
    </div>
  );
}
