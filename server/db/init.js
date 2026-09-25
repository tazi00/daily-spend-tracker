/**
 * Database initialization.
 *
 * Creates every table from scratch if missing and adds a starter user so the
 * single-user MVP has someone to own records. Schema changes later would go
 * through a migration step — not needed yet.
 */
import { db } from "./connection.js";
import { config } from "../utils/config.js";

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT,
      created_at    INTEGER NOT NULL
    );

    /*
     * One row per expense. Money is integer paise (₹120.50 → 12050).
     * date_key is the calendar day the money moved ("YYYY-MM-DD", computed by
     * the server in the app timezone) — that is what we filter/group on.
     * occurred_at is epoch milliseconds — what we sort by and display as time.
     */
    CREATE TABLE IF NOT EXISTS expenses (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title         TEXT    NOT NULL,
      amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
      occurred_at   INTEGER NOT NULL,
      date_key      TEXT    NOT NULL,
      notes         TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS income (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      source        TEXT    NOT NULL,
      amount_paise  INTEGER NOT NULL CHECK (amount_paise > 0),
      occurred_at   INTEGER NOT NULL,
      date_key      TEXT    NOT NULL,
      notes         TEXT,
      created_at    INTEGER NOT NULL,
      updated_at    INTEGER NOT NULL
    );

    /*
     * Summary-only historical months: the user knows "income ₹30,000,
     * expenses ₹29,700" without reconstructing every transaction.
     * One row per user per month key "YYYY-MM". Detailed months don't get a
     * row here — their totals are computed live from the record tables.
     */
    CREATE TABLE IF NOT EXISTS monthly_summaries (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month_key           TEXT    NOT NULL,
      total_income_paise  INTEGER NOT NULL CHECK (total_income_paise >= 0),
      total_expense_paise INTEGER NOT NULL CHECK (total_expense_paise >= 0),
      note                TEXT,
      created_at          INTEGER NOT NULL,
      updated_at          INTEGER NOT NULL,
      UNIQUE (user_id, month_key)
    );
  `);

  // Only the two access patterns the product actually has.
  // Today/timerange scans:            WHERE user_id = ? AND date_key = ?
  // Monthly history rollups:          WHERE user_id = ? AND substr(date_key, 1, 7) = ?
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date_key);
    CREATE INDEX IF NOT EXISTS idx_expenses_user_month ON expenses (user_id, substr(date_key, 1, 7));
    CREATE INDEX IF NOT EXISTS idx_income_user_date ON income (user_id, date_key);
    CREATE INDEX IF NOT EXISTS idx_income_user_month ON income (user_id, substr(date_key, 1, 7));
    CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month ON monthly_summaries (user_id, month_key);
  `);

  // MVP auth: one starter user owns all records. A real login system
  // (Phase 5) will replace this row with properly signed-up users.
  db.prepare(
    `INSERT INTO users (email, name, created_at) VALUES (?, ?, ?)
     ON CONFLICT (email) DO NOTHING`,
  ).run(config.starterUserEmail, "Ledger user", Date.now());
}
