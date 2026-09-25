/**
 * Income repository — all SQL for the income table.
 * Same conventions as the expenses repository.
 */
import { db } from "../db/connection.js";

const SELECT_COLUMNS = `
  id, user_id AS userId, source, amount_paise AS amountPaise,
  occurred_at AS occurredAt, date_key AS dateKey, notes,
  created_at AS createdAt, updated_at AS updatedAt
`;

export function findByUserAndDateRange(userId, from, to) {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM income
       WHERE user_id = ? AND date_key >= ? AND date_key <= ?
       ORDER BY occurred_at DESC, id DESC`,
    )
    .all(userId, from, to);
}

export function findById(id) {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM income WHERE id = ?`)
    .get(id);
}

export function insert({ userId, source, amountPaise, occurredAt, dateKey, notes, now }) {
  const result = db
    .prepare(
      `INSERT INTO income
         (user_id, source, amount_paise, occurred_at, date_key, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, source, amountPaise, occurredAt, dateKey, notes, now, now);
  return result.lastInsertRowid;
}

export function update(id, { source, amountPaise, occurredAt, dateKey, notes, now }) {
  db.prepare(
    `UPDATE income
     SET source = ?, amount_paise = ?, occurred_at = ?, date_key = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
  ).run(source, amountPaise, occurredAt, dateKey, notes, now, id);
}

export function remove(id) {
  db.prepare(`DELETE FROM income WHERE id = ?`).run(id);
}
