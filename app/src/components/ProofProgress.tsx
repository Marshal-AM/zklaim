import type { ProofProgressStage } from "@zklaim/proof-gen";

const STAGES: { key: ProofProgressStage; label: string; index: number }[] = [
  { key: "policy", label: "Verifying policy", index: 1 },
  { key: "amount", label: "Proving amount range", index: 2 },
  { key: "doctor", label: "Verifying doctor", index: 3 },
  { key: "accum", label: "Updating deductible", index: 4 },
  { key: "fraud", label: "Fraud ASP check", index: 5 },
  { key: "nullifier", label: "Finalizing nullifier", index: 6 },
];

interface ProofProgressProps {
  currentStage: ProofProgressStage | null;
  startedAt: number | null;
  completed?: boolean;
  completedAt?: number | null;
}

export function ProofProgress({
  currentStage,
  startedAt,
  completed = false,
  completedAt = null,
}: ProofProgressProps) {
  const currentIndex = completed
    ? STAGES.length
    : (STAGES.find((s) => s.key === currentStage)?.index ?? 0);
  const endTime = completed && completedAt ? completedAt : Date.now();
  const elapsed = startedAt ? Math.floor((endTime - startedAt) / 1000) : 0;

  return (
    <div className="card-padded space-y-4">
      <p className="text-sm text-muted-foreground">
        {completed
          ? "Submission finished — review the activity log below"
          : "Your diagnosis stays private · ~7–10 seconds"}
        {startedAt ? ` · ${elapsed}s` : ""}
      </p>
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const done = completed || stage.index <= currentIndex;
          const active = !completed && stage.key === currentStage;
          return (
            <div
              key={stage.key}
              className={`surface-row flex items-center gap-3 px-4 py-3 transition-fluid ${
                active
                  ? "border-primary/50 bg-primary/10"
                  : done
                    ? "opacity-100"
                    : "opacity-60"
              }`}
            >
              <span
                className={`w-8 font-mono text-xs font-[650] ${
                  done ? "text-primary" : "text-subtle"
                }`}
              >
                {stage.index}/6
              </span>
              <span className={done ? "text-foreground" : "text-muted-foreground"}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-fluid"
          style={{ width: `${(currentIndex / 6) * 100}%` }}
        />
      </div>
    </div>
  );
}
