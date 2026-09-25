/**
 * Users repository — SQL for the users table.
 * The MVP has a single starter user; Phase 5 login will extend this file.
 */
import { db } from "../db/connection.js";

const SELECT_COLUMNS = `id, email, name, created_at AS createdAt`;

export function findByEmail(email) {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = ?`)
    .get(email);
}

export function findById(id) {
  return db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = ?`)
    .get(id);
}
