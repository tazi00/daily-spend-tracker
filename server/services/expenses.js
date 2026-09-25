/**
 * Expense service — business rules for the core flow: see today's spending,
 * add an expense, edit it, delete it.
 *
 * Validation is authoritative here, not in the browser. All amounts are
 * integer paise. "Today" is computed by the server in the configured
 * timezone, so device clock skew cannot move saved money to the wrong day.
 */
import * as repo from "../repositories/expenses.js";
import { todayKey, normalizeOccurredAt } from "../utils/dates.js";
import {
  ServiceError,
  validateAmount,
  rejectFloatAmount,
  validateTitle,
  validateDateKey,
  cleanNotes,
  rupeesToPaise,
} from "../utils/validation.js";

/**
 * Accept money from the client in two safe forms:
 *  - integer paise (preferred: { amountPaise: 12050 })
 *  - rupee string (convenience: { amountRupees: "120.50" }) — re-parsed here
 * A float for amountPaise is rejected outright.
 */
function resolveAmountPaise(body) {
  if (body.amountPaise !== undefined) {
    rejectFloatAmount(body.amountPaise);
    return body.amountPaise;
  }
  if (body.amountRupees !== undefined) {
    const paise = rupeesToPaise(body.amountRupees);
    if (paise === null) {
      throw new ServiceError(
        "INVALID_AMOUNT",
        "Enter a valid amount, like 120 or 120.50",
      );
    }
    return paise;
  }
  throw new ServiceError("INVALID_AMOUNT", "Amount is required");
}

function validateExpenseFields(body) {
  validateTitle(body.title);
  const amountPaise = resolveAmountPaise(body);
  validateAmount(amountPaise);
  validateDateKey(body.dateKey);
  return { title: body.title.trim(), amountPaise, dateKey: body.dateKey };
}

/** Today's expenses + total. The server decides what "today" is. */
export function today(userId) {
  const dateKey = todayKey();
  const expenses = repo.findByUserAndDate(userId, dateKey);
  // Total derived from rows — the database is the source of truth, the
  // client's total is never trusted.
  const totalPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  return { dateKey, expenses, totalPaise };
}

/** Expenses in an inclusive date range (used by History). */
export function listBetween(userId, from, to) {
  if (from) validateDateKey(from);
  if (to) validateDateKey(to);
  const expenses = repo.findByUserAndDateRange(userId, from ?? "0000-01-01", to ?? "9999-12-31");
  const totalPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);
  return { expenses, totalPaise };
}

export function create(userId, body) {
  const { title, amountPaise, dateKey } = validateExpenseFields(body);

  // The server normalizes the timestamp into the app timezone so
  // occurredAt always corresponds to dateKey. Clients may send occurredAt,
  // but a missing/nonsense value falls back to "now" on the server's clock.
  let raw = Number(body.occurredAt);
  if (!Number.isFinite(raw) || raw <= 0) raw = Date.now();
  // Refuse far-future timestamps (clock skew protection), like the old stack.
  if (raw > Date.now() + 60_000) {
    throw new ServiceError("INVALID_TIMESTAMP", "Timestamp is in the future");
  }
  const occurredAt = normalizeOccurredAt(raw);

  const now = Date.now();
  const id = repo.insert({
    userId,
    title,
    amountPaise,
    occurredAt,
    dateKey,
    notes: cleanNotes(body.notes),
    now,
  });
  return repo.findById(id);
}

export function update(userId, id, body) {
  const existing = repo.findById(id);
  if (!existing || existing.userId !== userId) {
    // Same message whether the row is missing or foreign — no leaking.
    throw new ServiceError("NOT_FOUND", "Expense not found", 404);
  }

  const { title, amountPaise, dateKey } = validateExpenseFields(body);

  let raw = Number(body.occurredAt);
  if (!Number.isFinite(raw) || raw <= 0) raw = existing.occurredAt;
  if (raw > Date.now() + 60_000) {
    throw new ServiceError("INVALID_TIMESTAMP", "Timestamp is in the future");
  }
  const occurredAt = normalizeOccurredAt(raw);

  repo.update(id, {
    title,
    amountPaise,
    occurredAt,
    dateKey,
    notes: body.notes !== undefined ? cleanNotes(body.notes) : existing.notes,
    now: Date.now(),
  });
  return repo.findById(id);
}

export function remove(userId, id) {
  const existing = repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Expense not found", 404);
  }
  repo.remove(id);
}
