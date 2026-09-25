/**
 * Expense repository — all SQL for the expenses table lives here.
 * Services call these functions; nothing else in the codebase writes SQL.
 * Every statement uses ? placeholders.
 */
import { db } from "../db/connection.js";

const SELECT_COLUMNS = `
  id, user_id AS userId, title, amount_paise AS amountPaise,
  occurred_at AS occurredAt, date_key AS dateKey, notes,
  created_at AS createdAt, updated_at AS updatedAt
`;

/** All expenses for a user on one calendar day, newest first. */
export function findByUserAndDate(userId, dateKey) {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM expenses
       WHERE user_id = ? AND date_key = ?
       ORDER BY occurred_at DESC, id DESC`,
    )
    .all(userId, dateKey);
}

/** Expenses for a user within an inclusive date-key range, newest first. */
export function findByUserAndDateRange(userId, from, to) {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM expenses
       WHERE user_id = ? AND date_key >= ? AND date_key <= ?
       ORDER BY occurred_at DESC, id DESC`,
    )
    .all(userId, from, to);
}

/** One expense by id. Ownership is enforced by callers (services). */
export function findById(id) {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM expenses WHERE id = ?`)
    .get(id);
}

export function insert({ userId, title, amountPaise, occurredAt, dateKey, notes, now }) {
  const result = db
    .prepare(
      `INSERT INTO expenses
         (user_id, title, amount_paise, occurred_at, date_key, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, title, amountPaise, occurredAt, dateKey, notes, now, now);
  return result.lastInsertRowid;
}

export function update(id, { title, amountPaise, occurredAt, dateKey, notes, now }) {
  db.prepare(
    `UPDATE expenses
     SET title = ?, amount_paise = ?, occurred_at = ?, date_key = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(title, amountPaise, occurredAt, dateKey, notes, now, id);
}

export function remove(id) {
  db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id);
}
