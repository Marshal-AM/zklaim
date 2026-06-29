import { useEffect, useId, useRef, useState } from "react";
import {
  displayToVisitYmd,
  formatVisitDateTyping,
  isValidVisitYmd,
  nativeValueToVisitYmd,
  partsToYmd,
  todayVisitYmd,
  visitYmdToDisplay,
  visitYmdToNativeValue,
  visitYmdToParts,
} from "../../lib/visitDate";

interface VisitDatePickerProps {
  value: string;
  onChange: (ymd: string) => void;
  id?: string;
  disabled?: boolean;
  /** Earliest selectable day (YYYYMMDD). */
  minYmd?: string;
  /** Latest selectable day (YYYYMMDD). */
  maxYmd?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeft({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function monthMatrix(year: number, month: number): Array<number | null> {
  const first = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isYmdInRange(
  ymd: string,
  minYmd?: string,
  maxYmd?: string,
): boolean {
  if (!isValidVisitYmd(ymd)) return false;
  const n = Number(ymd);
  if (minYmd && n < Number(minYmd)) return false;
  if (maxYmd && n > Number(maxYmd)) return false;
  return true;
}

export function VisitDatePicker({
  value,
  onChange,
  id: idProp,
  disabled = false,
  minYmd,
  maxYmd,
}: VisitDatePickerProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const rootRef = useRef<HTMLDivElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [displayText, setDisplayText] = useState(() =>
    isValidVisitYmd(value) ? visitYmdToDisplay(value) : "",
  );
  const [invalid, setInvalid] = useState(false);

  const initialParts =
    visitYmdToParts(value) ??
    visitYmdToParts(todayVisitYmd()) ?? { year: 2026, month: 6, day: 1 };
  const [viewYear, setViewYear] = useState(initialParts.year);
  const [viewMonth, setViewMonth] = useState(initialParts.month);

  useEffect(() => {
    if (isValidVisitYmd(value)) {
      setDisplayText(visitYmdToDisplay(value));
      setInvalid(false);
      const p = visitYmdToParts(value);
      if (p) {
        setViewYear(p.year);
        setViewMonth(p.month);
      }
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function commitYmd(ymd: string) {
    if (!isYmdInRange(ymd, minYmd, maxYmd)) {
      setInvalid(true);
      return;
    }
    onChange(ymd);
    setDisplayText(visitYmdToDisplay(ymd));
    setInvalid(false);
    const p = visitYmdToParts(ymd);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
  }

  function handleTextChange(raw: string) {
    const formatted = formatVisitDateTyping(raw);
    setDisplayText(formatted);
    const ymd = displayToVisitYmd(formatted);
    if (ymd && isYmdInRange(ymd, minYmd, maxYmd)) {
      onChange(ymd);
      setInvalid(false);
    } else if (formatted.replace(/\D/g, "").length === 8) {
      setInvalid(true);
    } else {
      setInvalid(false);
    }
  }

  function handleTextBlur() {
    const ymd = displayToVisitYmd(displayText);
    if (ymd && isYmdInRange(ymd, minYmd, maxYmd)) {
      commitYmd(ymd);
      return;
    }
    if (isValidVisitYmd(value)) {
      setDisplayText(visitYmdToDisplay(value));
      setInvalid(false);
    } else {
      setInvalid(displayText.replace(/\D/g, "").length > 0);
    }
  }

  function handleNativeChange(iso: string) {
    const ymd = nativeValueToVisitYmd(iso);
    if (ymd) {
      commitYmd(ymd);
      setOpen(false);
    }
  }

  function handleDayPick(day: number) {
    const ymd = partsToYmd(viewYear, viewMonth, day);
    if (isYmdInRange(ymd, minYmd, maxYmd)) {
      commitYmd(ymd);
      setOpen(false);
      textRef.current?.focus();
    }
  }

  function openCalendar() {
    if (disabled) return;
    const p = visitYmdToParts(value);
    if (p) {
      setViewYear(p.year);
      setViewMonth(p.month);
    }
    if (nativeRef.current && typeof nativeRef.current.showPicker === "function") {
      try {
        nativeRef.current.showPicker();
        return;
      } catch {
        // Fall back to custom popover when showPicker is blocked.
      }
    }
    setOpen((v) => !v);
  }

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth - 1 + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth() + 1);
  }

  const today = todayVisitYmd();
  const selectedYmd = isValidVisitYmd(value) ? value : null;
  const cells = monthMatrix(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth - 1, 1).toLocaleString(
    undefined,
    { month: "long", year: "numeric" },
  );

  const nativeMin = minYmd && isValidVisitYmd(minYmd)
    ? visitYmdToNativeValue(minYmd)
    : "1900-01-01";
  const nativeMax = maxYmd && isValidVisitYmd(maxYmd)
    ? visitYmdToNativeValue(maxYmd)
    : "2099-12-31";

  return (
    <div ref={rootRef} className="date-picker">
      <div
        className={`date-picker__control input-group input-group--lg ${
          invalid ? "input-group--invalid" : ""
        }`}
      >
        <input
          ref={textRef}
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder="YYYY-MM-DD"
          value={displayText}
          onChange={(e) => handleTextChange(e.target.value)}
          onBlur={handleTextBlur}
          aria-invalid={invalid}
          aria-describedby={hintId}
          className="input-group__field font-mono tracking-wide"
        />
        <button
          type="button"
          disabled={disabled}
          onClick={openCalendar}
          aria-label="Open calendar"
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          className="date-picker__trigger"
        >
          <CalendarIcon className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="date-picker__native"
        value={selectedYmd ? visitYmdToNativeValue(selectedYmd) : ""}
        min={nativeMin}
        max={nativeMax}
        onChange={(e) => handleNativeChange(e.target.value)}
      />

      {open ? (
        <div
          id={`${id}-calendar`}
          role="dialog"
          aria-label="Choose visit date"
          className="date-picker__popover"
        >
          <div className="date-picker__header">
            <button
              type="button"
              className="date-picker__nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="date-picker__month">{monthLabel}</p>
            <button
              type="button"
              className="date-picker__nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="date-picker__weekdays">
            {WEEKDAYS.map((d) => (
              <span key={d} className="date-picker__weekday">
                {d}
              </span>
            ))}
          </div>

          <div className="date-picker__grid" role="grid">
            {cells.map((day, idx) => {
              if (day === null) {
                return <span key={`empty-${idx}`} className="date-picker__cell" />;
              }
              const ymd = partsToYmd(viewYear, viewMonth, day);
              const selectable = isYmdInRange(ymd, minYmd, maxYmd);
              const isSelected = selectedYmd === ymd;
              const isToday = today === ymd;
              return (
                <button
                  key={ymd}
                  type="button"
                  role="gridcell"
                  disabled={!selectable}
                  onClick={() => handleDayPick(day)}
                  className={`date-picker__day ${
                    isSelected ? "date-picker__day--selected" : ""
                  } ${isToday ? "date-picker__day--today" : ""}`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <p className="date-picker__stored" aria-live="polite">
            Stored as{" "}
            <span className="font-mono">{selectedYmd ?? "—"}</span>
          </p>
        </div>
      ) : null}

      <p id={hintId} className="sr-only">
        Type a date as YYYY-MM-DD or use the calendar. Value is saved as
        YYYYMMDD for the claim.
      </p>
    </div>
  );
}