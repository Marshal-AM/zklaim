import type { ProofProgressStage } from "@zklaim/proof-gen";

const STAGES: { key: ProofProgressStage; label: string; index: number }[] = [
  { key: "policy", label: "Verifying policy", index: 1 },
  { key: "amount", label: "Proving amount range", index: 2 },
  { key: "doctor", label: "Verifying doctor", index: 3 },
  { key: "accum", label: "Updating deductible", index: 4 },
];

interface ProofProgressProps {
  currentStage: ProofProgressStage | null;
  startedAt: number | null;
}

export function ProofProgress({ currentStage, startedAt }: ProofProgressProps) {
  const currentIndex =
    STAGES.find((s) => s.key === currentStage)?.index ?? 0;
  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Your diagnosis stays private · ~7–10 seconds
        {startedAt ? ` · ${elapsed}s` : ""}
      </p>
      <div className="space-y-2">
        {STAGES.map((stage) => {
          const done = stage.index <= currentIndex;
          const active = stage.key === currentStage;
          return (
            <div
              key={stage.key}
              className={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
                active
                  ? "border-emerald-500/50 bg-emerald-950/30"
                  : done
                    ? "border-slate-700 bg-slate-900/50"
                    : "border-slate-800 bg-slate-900/20"
              }`}
            >
              <span
                className={`text-xs font-mono w-8 ${
                  done ? "text-emerald-400" : "text-slate-600"
                }`}
              >
                {stage.index}/4
              </span>
              <span className={done ? "text-slate-200" : "text-slate-500"}>
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div
          className="h-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${(currentIndex / 4) * 100}%` }}
        />
      </div>
    </div>
  );
}
