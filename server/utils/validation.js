/**
 * Server-side validation. This is the authoritative gate — every field the
 * client sends is checked here before it touches the database.
 *
 * Each failure raises a ServiceError carrying a stable machine code, which
 * the API layer turns into `{ success: false, error: { message, code } }`.
 */
export class ServiceError extends Error {
  /**
   * @param {string} code stable machine-readable code (e.g. INVALID_AMOUNT)
   * @param {string} message human-readable message safe to show the user
   * @param {number} status HTTP status the API layer should respond with
   */
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// ₹1 crore per entry — a sanity ceiling, not a business rule.
export const MAX_AMOUNT_PAISE = 1_000_000_000;

/** Money arrives as integer paise and must stay integer paise. */
export function validateAmount(amountPaise, { allowZero = false } = {}) {
  if (
    typeof amountPaise !== "number" ||
    !Number.isSafeInteger(amountPaise) ||
    (allowZero ? amountPaise < 0 : amountPaise <= 0)
  ) {
    throw new ServiceError(
      "INVALID_AMOUNT",
      "Invalid amount: must be a positive amount in paise",
    );
  }
  if (amountPaise > MAX_AMOUNT_PAISE) {
    throw new ServiceError(
      "INVALID_AMOUNT",
      "Invalid amount: exceeds the maximum allowed",
    );
  }
}

/** Reject non-integer money outright — floats never reach the database. */
export function rejectFloatAmount(amountPaise) {
  if (typeof amountPaise === "number" && !Number.isInteger(amountPaise)) {
    throw new ServiceError(
      "INVALID_AMOUNT",
      "Amount must be integer paise (e.g. 12050 for ₹120.50)",
    );
  }
}

export function validateTitle(title) {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new ServiceError("TITLE_REQUIRED", "Title is required");
  }
  if (title.trim().length > 80) {
    throw new ServiceError("TITLE_TOO_LONG", "Title is too long — 80 characters max");
  }
}

export function validateSource(source) {
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new ServiceError("SOURCE_REQUIRED", "Source is required");
  }
  if (source.trim().length > 40) {
    throw new ServiceError("SOURCE_TOO_LONG", "Source is too long — 40 characters max");
  }
}

/** Shape check for "YYYY-MM-DD" (calendar correctness is not worth the code). */
export function validateDateKey(dateKey) {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new ServiceError("INVALID_DATE", "Invalid date");
  }
}

/** Shape check for "YYYY-MM". */
export function validateMonthKey(monthKey) {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new ServiceError("INVALID_MONTH", "Invalid month");
  }
}

/** Trim a string and collapse empty to null — keeps notes columns clean. */
export function cleanNotes(notes) {
  if (typeof notes !== "string" || notes.trim().length === 0) return null;
  return notes.trim().slice(0, 500);
}

/**
 * Convert a client-supplied rupee string ("120", "120.5", "₹1,200.50") into
 * integer paise. The client does this too for fast feedback; the server
 * re-derives from the raw string so a miscalculating client can't win.
 * Returns null when the input is not a valid rupee amount.
 */
export function rupeesToPaise(input) {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const [rupees, paise = ""] = cleaned.split(".");
  const paisePart = (paise + "00").slice(0, 2);
  const value = Number(rupees) * 100 + Number(paisePart);
  return Number.isSafeInteger(value) ? value : null;
}
