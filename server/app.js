/**
 * Express app — routes, static serving, error envelope.
 * Kept separate from server.js so verification scripts can import the app
 * without binding a port.
 */
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initDatabase } from "./db/init.js";
import { config } from "./utils/config.js";
import { ServiceError } from "./utils/validation.js";
import { requireUser, currentUser, issueToken } from "./services/auth.js";
import expensesRoutes from "./routes/expenses.js";
import incomeRoutes from "./routes/income.js";
import monthlyRoutes from "./routes/monthly.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

initDatabase();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

// ---------- API ----------

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    data: {
      status: "ok",
      today: new Date().toISOString(),
      timezone: config.timezone,
    },
  });
});

// MVP identity: hand out a signed token for the starter user. Real
// sign-up/sign-in (Phase 5) replaces this endpoint; nothing else changes.
app.post("/api/auth/token", (req, res) => {
  const user = currentUser();
  res.json({ success: true, data: { token: issueToken(user.id), user } });
});

// Ownership middleware runs ahead of every record route.
app.use("/api/expenses", requireUser, expensesRoutes);
app.use("/api/income", requireUser, incomeRoutes);
app.use("/api/monthly", requireUser, monthlyRoutes);

// Unknown API paths get the JSON 404, not the SPA page.
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: { message: "Not found", code: "NOT_FOUND" },
  });
});

// ---------- Static frontend ----------

const publicDir = path.join(__dirname, "..", "public");
app.use(express.static(publicDir));
// SPA-style fallback so /history (a client-side "page") also serves the app.
// Express 5 needs a named wildcard ("/*splat"), not the old "*".
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ---------- Error envelope ----------

// eslint-disable-next-line no-unused-vars — express needs the 4-arg signature
app.use((err, req, res, next) => {
  if (err instanceof ServiceError) {
    return res.status(err.status ?? 400).json({
      success: false,
      error: { message: err.message, code: err.code },
    });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      error: { message: "Request body must be valid JSON", code: "INVALID_JSON" },
    });
  }
  console.error("[server] unexpected error:", err);
  return res.status(500).json({
    success: false,
    error: { message: "Something went wrong", code: "INTERNAL" },
  });
});

export default app;
