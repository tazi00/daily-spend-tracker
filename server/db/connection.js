/**
 * Database connection.
 *
 * One synchronous better-sqlite3 connection for the whole process. SQLite is
 * fast enough that this is all we need — no pooling layer, no ORM. Every query
 * elsewhere is written with `?` placeholders so user input can never change
 * the shape of the SQL.
 */
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

import { config } from "../utils/config.js";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// WAL = better concurrency + durability without much setup.
db.pragma("journal_mode = WAL");
// Refuse writes that would violate foreign keys (e.g. an expense without a user).
db.pragma("foreign_keys = ON");
