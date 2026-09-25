/**
 * Monthly summaries repository — SQL for summary-only historical months.
 * One row per user per "YYYY-MM" (UNIQUE constraint guarantees it).
 */
import { db } from "../db/connection.js";

const SELECT_COLUMNS = `
  id, user_id AS userId, month_key AS monthKey,
  total_income_paise AS totalIncomePaise, total_expense_paise AS totalExpensePaise,
  note, created_at AS createdAt, updated_at AS updatedAt
`;

export function findByUserAndMonth(userId, monthKey) {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM monthly_summaries
       WHERE user_id = ? AND month_key = ?`,
    )
    .get(userId, monthKey);
}

export function listByUser(userId) {
  return db
    .prepare(
      `SELECT ${SELECT_COLUMNS} FROM monthly_summaries
       WHERE user_id = ? ORDER BY month_key DESC`,
    )
    .all(userId);
}

export function upsert({ userId, monthKey, totalIncomePaise, totalExpensePaise, note, now }) {
  db.prepare(
    `INSERT INTO monthly_summaries
       (user_id, month_key, total_income_paise, total_expense_paise, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, month_key)
     DO UPDATE SET
       total_income_paise = excluded.total_income_paise,
       total_expense_paise = excluded.total_expense_paise,
       note = excluded.note,
       updated_at = excluded.updated_at`,
  ).run(userId, monthKey, totalIncomePaise, totalExpensePaise, note, now, now);
}

export function remove(userId, monthKey) {
  db.prepare(
    `DELETE FROM monthly_summaries WHERE user_id = ? AND month_key = ?`,
  ).run(userId, monthKey);
}
