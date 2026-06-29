interface StepFormNavProps {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  busy?: boolean;
  isLastStep?: boolean;
}

export function StepFormNav({
  onBack,
  onNext,
  nextLabel = "Continue",
  backLabel = "Back",
  nextDisabled = false,
  busy = false,
  isLastStep = false,
}: StepFormNavProps) {
  return (
    <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="btn-secondary w-full sm:w-auto"
        >
          {backLabel}
        </button>
      ) : (
        <span />
      )}
      {onNext ? (
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || busy}
          className="btn-primary w-full sm:ml-auto sm:w-auto"
        >
          {busy ? "Please wait…" : isLastStep ? (nextLabel || "Submit") : nextLabel}
        </button>
      ) : null}
    </div>
  );
}
