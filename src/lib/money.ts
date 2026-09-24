/**
 * Money & date helpers.
 *
 * All amounts are stored and computed as integers in paise (₹120.50 → 12050),
 * so totals never suffer floating-point drift. Formatting happens only at the
 * edges (UI), math happens only on integers (here and on the server).
 */

export const PAISE_PER_RUPEE = 100;

/** Parse a user-typed rupee amount ("120", "120.5", "₹120.50") into paise. Returns null when invalid. */
export function parseAmountToPaise(input: string): number | null {
  const cleaned = input.trim().replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  if (cleaned === "" || cleaned === ".") return null;
  const [rupees, paise = ""] = cleaned.split(".");
  const paisePart = (paise + "00").slice(0, 2);
  const value = Number(rupees) * PAISE_PER_RUPEE + Number(paisePart);
  return Number.isSafeInteger(value) ? value : null;
}

/** Format paise for display: 12050 → "₹120.50", 12000 → "₹120" (no dangling .00). */
export function formatPaise(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;
  const rupeeText = rupees.toLocaleString("en-IN");
  return remainder === 0
    ? `${sign}₹${rupeeText}`
    : `${sign}₹${rupeeText}.${String(remainder).padStart(2, "0")}`;
}

/** Format paise with forced two decimals (statements/summaries): 12000 → "₹120.00". */
export function formatPaiseExact(paise: number): string {
  const text = formatPaise(paise);
  return text.includes(".") ? text : `${text}.00`;
}

/** Local-timezone YYYY-MM-DD key for a Date — the unit the database filters on. */
export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** UTC month key "YYYY-MM" for a date string ("2026-09-14") or Date. */
export function monthKey(date: string | Date): string {
  const key = typeof date === "string" ? date : dateKey(date);
  return key.slice(0, 7);
}

/** "2026-09" → "September 2026" (UTC-based; month keys have no time component). */
export function formatMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-09-14" → "Sun, 14 Sep" (or with year when showYear). */
export function formatDateKey(key: string, showYear = false): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: showYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** "HH:MM" from epoch millis, in the viewer's local time. */
export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Epoch-millis bounds [start, end) of a local day, e.g. for date pickers. */
export function dayBounds(key: string): { start: number; end: number } {
  const [y, m, d] = key.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  return { start, end: start + 24 * 60 * 60 * 1000 };
}
