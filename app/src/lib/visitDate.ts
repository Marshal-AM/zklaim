/** Claim visit dates are stored as YYYYMMDD integers (e.g. 20260629). */
export type VisitDateYmd = string;

export const VISIT_DATE_MIN = 19000101;
export const VISIT_DATE_MAX = 20991231;

export function todayVisitYmd(): string {
  const d = new Date();
  return partsToYmd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function partsToYmd(year: number, month: number, day: number): string {
  return (
    String(year).padStart(4, "0") +
    String(month).padStart(2, "0") +
    String(day).padStart(2, "0")
  );
}

export function visitYmdToParts(
  ymd: string,
): { year: number; month: number; day: number } | null {
  if (!/^\d{8}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(4, 6));
  const day = Number(ymd.slice(6, 8));
  if (!isValidYmdParts(year, month, day)) return null;
  return { year, month, day };
}

export function isValidYmdParts(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1900 ||
    year > 2099 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const probe = new Date(year, month - 1, day);
  return (
    probe.getFullYear() === year &&
    probe.getMonth() === month - 1 &&
    probe.getDate() === day
  );
}

export function isValidVisitYmd(ymd: string): boolean {
  if (!/^\d{8}$/.test(ymd)) return false;
  const n = Number(ymd);
  if (n < VISIT_DATE_MIN || n > VISIT_DATE_MAX) return false;
  const parts = visitYmdToParts(ymd);
  return parts !== null;
}

/** Human-readable display for inputs: YYYY-MM-DD */
export function visitYmdToDisplay(ymd: string): string {
  if (!/^\d{8}$/.test(ymd)) return ymd;
  return `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
}

/** Native `<input type="date">` value (same calendar day, no timezone shift). */
export function visitYmdToNativeValue(ymd: string): string {
  return visitYmdToDisplay(ymd);
}

export function nativeValueToVisitYmd(iso: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return null;
  const ymd = partsToYmd(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  );
  return isValidVisitYmd(ymd) ? ymd : null;
}

/** Format free-form typing (digits only) into YYYY-MM-DD as the user types. */
export function formatVisitDateTyping(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function displayToVisitYmd(display: string): string | null {
  const digits = display.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  return isValidVisitYmd(digits) ? digits : null;
}

export function visitYmdToNumber(ymd: string): number {
  return Number(ymd);
}
