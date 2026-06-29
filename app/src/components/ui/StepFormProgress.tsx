interface StepFormProgressProps {
  steps: string[];
  currentStep: number;
}

export function StepFormProgress({ steps, currentStep }: StepFormProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;
  const currentLabel = steps[currentStep];

  return (
    <div className="mb-8 flex flex-col items-center">
      <div className="w-full max-w-sm sm:max-w-md">
        <p className="text-center text-xs leading-relaxed">
          <span className="font-[650] uppercase tracking-wider text-muted-foreground">
            Step {currentStep + 1} of {steps.length}
          </span>
          <span className="mx-1.5 text-border" aria-hidden>
            ·
          </span>
          <span className="font-[650] text-foreground">{currentLabel}</span>
        </p>
        <div
          className="mt-2.5 h-1 overflow-hidden rounded-full bg-muted/50"
          role="progressbar"
          aria-valuenow={currentStep + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`${currentLabel}, step ${currentStep + 1} of ${steps.length}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ol className="mt-4 flex flex-wrap justify-center gap-1.5">
        {steps.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <li
              key={label}
              className={`rounded-full px-2.5 py-1 text-[10px] font-[650] uppercase tracking-wider ${
                active
                  ? "bg-primary/15 text-primary"
                  : done
                    ? "bg-success/15 text-success"
                    : "bg-muted/30 text-muted-foreground"
              }`}
            >
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
