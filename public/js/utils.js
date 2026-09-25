/**
 * Money & date helpers (client side).
 *
 * Money rule: parse user input into integer paise as early as possible and
 * format paise into ₹ strings as late as possible. Math on the client is only
 * for display hints — the server recomputes all totals.
 */

const PAISE_PER_RUPEE = 100;

/** Parse a typed rupee amount ("120", "120.5", "₹1,200.50") into paise. null when invalid. */
export function parseAmountToPaise(input) {
  const cleaned = String(input).trim().replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned) || cleaned === "") return null;
  const [rupees, paise = ""] = cleaned.split(".");
  const paisePart = (paise + "00").slice(0, 2);
  const value = Number(rupees) * PAISE_PER_RUPEE + Number(paisePart);
  return Number.isSafeInteger(value) ? value : null;
}

/** Format paise for display: 12050 → "₹120.50", 12000 → "₹120". */
export function formatPaise(paise) {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const remainder = abs % PAISE_PER_RUPEE;
  const rupeeText = rupees.toLocaleString("en-IN");
  return remainder === 0
    ? `${sign}₹${rupeeText}`
    : `${sign}₹${rupeeText}.${String(remainder).padStart(2, "0")}`;
}

/** "HH:MM" for an epoch-millis timestamp. */
export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "2026-09" → "September 2026". */
export function formatMonthKey(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-09-14" → "Sun, 14 Sep" (with year when showYear). */
export function formatDateKey(key, showYear = false) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: showYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Long human date for the masthead: "Wednesday, 24 September 2026". */
export function formatTodayLong() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Current "YYYY-MM-DD" in the browser's timezone (for form defaults only). */
export function localDateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Current "HH:MM" (for form defaults only). */
export function localTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Epoch millis for a dateKey + "HH:MM" in the browser's local time. */
export function localEpoch(dateKey, hhmm) {
  return new Date(`${dateKey}T${hhmm || "12:00"}`).getTime();
}

/** Strip the trailing "(CODE)" the server appends to some messages. */
export function friendly(message) {
  return String(message).replace(/\s*\([A-Z_]+\)\s*$/, "");
}
