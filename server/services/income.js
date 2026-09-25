/**
 * Income service — Salary / Freelance / Other (free-text source, validated
 * server-side). Same money and ownership rules as expenses.
 */
import * as repo from "../repositories/income.js";
import { normalizeOccurredAt } from "../utils/dates.js";
import {
  ServiceError,
  validateAmount,
  rejectFloatAmount,
  validateSource,
  validateDateKey,
  cleanNotes,
  rupeesToPaise,
} from "../utils/validation.js";

function resolveAmountPaise(body) {
  if (body.amountPaise !== undefined) {
    rejectFloatAmount(body.amountPaise);
    return body.amountPaise;
  }
  if (body.amountRupees !== undefined) {
    const paise = rupeesToPaise(body.amountRupees);
    if (paise === null) {
      throw new ServiceError("INVALID_AMOUNT", "Enter a valid amount, like 30000 or 30000.50");
    }
    return paise;
  }
  throw new ServiceError("INVALID_AMOUNT", "Amount is required");
}

export function listBetween(userId, from, to) {
  if (from) validateDateKey(from);
  if (to) validateDateKey(to);
  const income = repo.findByUserAndDateRange(userId, from ?? "0000-01-01", to ?? "9999-12-31");
  const totalPaise = income.reduce((sum, r) => sum + r.amountPaise, 0);
  return { income, totalPaise };
}

export function create(userId, body) {
  validateSource(body.source);
  const amountPaise = resolveAmountPaise(body);
  validateAmount(amountPaise);
  validateDateKey(body.dateKey);

  let raw = Number(body.occurredAt);
  if (!Number.isFinite(raw) || raw <= 0) raw = Date.now();
  if (raw > Date.now() + 60_000) {
    throw new ServiceError("INVALID_TIMESTAMP", "Timestamp is in the future");
  }
  const occurredAt = normalizeOccurredAt(raw);

  const now = Date.now();
  const id = repo.insert({
    userId,
    source: body.source.trim(),
    amountPaise,
    occurredAt,
    dateKey: body.dateKey,
    notes: cleanNotes(body.notes),
    now,
  });
  return repo.findById(id);
}

export function update(userId, id, body) {
  const existing = repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Income not found", 404);
  }

  validateSource(body.source);
  const amountPaise = resolveAmountPaise(body);
  validateAmount(amountPaise);
  validateDateKey(body.dateKey);

  let raw = Number(body.occurredAt);
  if (!Number.isFinite(raw) || raw <= 0) raw = existing.occurredAt;
  if (raw > Date.now() + 60_000) {
    throw new ServiceError("INVALID_TIMESTAMP", "Timestamp is in the future");
  }
  const occurredAt = normalizeOccurredAt(raw);

  repo.update(id, {
    source: body.source.trim(),
    amountPaise,
    occurredAt,
    dateKey: body.dateKey,
    notes: body.notes !== undefined ? cleanNotes(body.notes) : existing.notes,
    now: Date.now(),
  });
  return repo.findById(id);
}

export function remove(userId, id) {
  const existing = repo.findById(id);
  if (!existing || existing.userId !== userId) {
    throw new ServiceError("NOT_FOUND", "Income not found", 404);
  }
  repo.remove(id);
}
