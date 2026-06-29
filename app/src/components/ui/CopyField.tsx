import { useState } from "react";
import { toast } from "../../lib/toast";

interface CopyFieldProps {
  label: string;
  value: string;
  hint?: string;
  /** Shown in the UI; full `value` is still copied */
  displayValue?: string;
  id?: string;
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CopyField({
  label,
  value,
  hint,
  displayValue,
  id,
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="copy-field">
      <div className="copy-field__header">
        <label className="section-label" htmlFor={id}>
          {label}
        </label>
        {hint ? <p className="copy-field__hint">{hint}</p> : null}
      </div>
      <div className="copy-field__row">
        <code id={id} className="copy-field__value text-safe-mono">
          {displayValue ?? value}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="copy-field__btn"
          aria-label={`Copy ${label}`}
        >
          {copied ? (
            <CheckIcon className="h-4 w-4 text-success" />
          ) : (
            <CopyIcon className="h-4 w-4" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
    </div>
  );
}

export function truncateMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

interface ProminentCopyCredentialProps {
  label: string;
  value: string;
  copyLabel?: string;
  id?: string;
  /** Shrink-wrap and center the address block */
  contained?: boolean;
}

/** Hero-style credential block for share-with-provider flows */
export function ProminentCopyCredential({
  label,
  value,
  copyLabel = "Copy address",
  id,
  contained = false,
}: ProminentCopyCredentialProps) {
  const [copied, setCopied] = useState(false);
  const fieldId = id ?? "share-credential";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div
      className={`share-credential ${contained ? "share-credential--contained" : ""}`}
    >
      <p className="share-credential__label">{label}</p>
      <div className="share-credential__hero">
        <code id={fieldId} className="share-credential__value text-safe-mono">
          {value}
        </code>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="btn-primary share-credential__copy"
        >
          {copied ? "Copied" : copyLabel}
        </button>
      </div>
    </div>
  );
}
