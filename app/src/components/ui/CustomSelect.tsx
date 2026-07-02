import { useEffect, useId, useMemo, useRef, useState } from "react";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  id?: string;
  className?: string;
  /** Max visible rows before scrolling (default 8). */
  maxVisibleRows?: number;
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  id: idProp,
  className = "",
  maxVisibleRows = 8,
}: CustomSelectProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listboxId = `${id}-listbox`;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedOptionRef = useRef<HTMLButtonElement>(null);
  const selected = options.find((o) => o.value === value) ?? null;

  const enabledOptions = useMemo(
    () => options.filter((o) => !o.disabled),
    [options],
  );

  useEffect(() => {
    if (!open) return;
    const selectedIdx = enabledOptions.findIndex((o) => o.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
    requestAnimationFrame(() => {
      selectedOptionRef.current?.scrollIntoView({ block: "nearest" });
    });
  }, [open, value, enabledOptions]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (!open || enabledOptions.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % enabledOptions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex(
          (i) => (i - 1 + enabledOptions.length) % enabledOptions.length,
        );
      } else if (e.key === "Home") {
        e.preventDefault();
        setActiveIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setActiveIndex(enabledOptions.length - 1);
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const opt = enabledOptions[activeIndex];
        if (opt) {
          onChange(opt.value);
          setOpen(false);
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, activeIndex, enabledOptions, onChange]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>(
      '[role="option"]:not(:disabled)',
    );
    buttons?.[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function selectOption(optValue: string) {
    onChange(optValue);
    setOpen(false);
  }

  // ~2.75rem row height × visible rows, capped at half the viewport
  const listMaxHeight = `min(${maxVisibleRows * 2.75}rem, 50vh)`;

  return (
    <div ref={rootRef} className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="input-field flex min-h-11 w-full cursor-pointer touch-manipulation items-center justify-between gap-2 text-left"
      >
        <span className="min-w-0 truncate font-[650]">
          {selected ? (
            selected.label
          ) : (
            <span className="font-normal text-muted-foreground">
              {placeholder}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          ref={listRef}
          role="listbox"
          aria-label={placeholder}
          className="absolute left-0 right-0 z-50 mt-2 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card shadow-[0_16px_48px_rgba(0,0,0,0.35)] [scrollbar-gutter:stable]"
          style={{ maxHeight: listMaxHeight }}
        >
          {options.map(({ value: optValue, label, description, disabled }) => {
            const enabledIdx = enabledOptions.findIndex(
              (o) => o.value === optValue,
            );
            const isSelected = value === optValue;
            const isActive = !disabled && enabledIdx === activeIndex;
            return (
              <button
                key={optValue}
                ref={isSelected ? selectedOptionRef : undefined}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={disabled}
                onClick={() => selectOption(optValue)}
                className={`flex min-h-11 w-full touch-manipulation flex-col justify-center gap-0.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40 ${
                  isSelected ? "bg-primary/10" : ""
                } ${isActive && !isSelected ? "bg-muted/30" : ""}`}
              >
                <span className="flex items-center justify-between gap-2 font-[650]">
                  {label}
                  {isSelected ? (
                    <svg
                      className="h-4 w-4 shrink-0 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden
                    >
                      <path
                        d="M20 6 9 17l-5-5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </span>
                {description ? (
                  <span className="text-xs text-muted-foreground">
                    {description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
