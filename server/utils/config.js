/**
 * Environment configuration — every tunable in one place.
 * Values come from environment variables (see .env.example); defaults keep
 * local development zero-config.
 */
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 3000,
  // IANA timezone name. The server decides what "today" means using this, so
  // a browser's clock/timezone can never move money to the wrong day.
  timezone: process.env.TZ || "Asia/Kolkata",
  dbPath: process.env.DB_PATH || "./data/ledger.sqlite",
  // Auth is a signed token today (Phase 5 will replace with real login);
  // the secret must come from the environment, never source control.
  authSecret:
    process.env.AUTH_SECRET || "dev-only-insecure-secret-change-me",
  starterUserEmail: process.env.STARTER_USER_EMAIL || "me@ledger.local",
};
