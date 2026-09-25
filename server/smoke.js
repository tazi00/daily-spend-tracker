/**
 * Verification script — exercises the full HTTP stack (routes, envelope,
 * error handling) against the real Express app, then exits.
 *
 * Listens on an OS-assigned port (0) so it never collides with the platform's
 * dev server and dies with the process. Not a test framework — just a script
 * that prints PASS/FAIL per check.
 *
 * Run: node server/smoke.js
 */
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Fresh throwaway database for every run, in the OS temp dir — so repeat runs
// start from zero and the real ledger is never touched.
const tmpDbDir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-smoke-"));
process.env.DB_PATH = path.join(tmpDbDir, "smoke.sqlite");

// Import AFTER setting env so config picks up the smoke DB path.
const { default: app } = await import("./app.js");

const server = http.createServer(app);
server.listen(0, "127.0.0.1", async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  let pass = 0;
  let fail = 0;
  const check = (name, cond, extra = "") => {
    if (cond) {
      pass++;
      console.log("PASS", name);
    } else {
      fail++;
      console.log("FAIL", name, extra);
    }
  };

  const call = async (method, path, body, headers = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    // Read the body exactly once, then parse.
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // non-JSON (HTML page) — leave null
    }
    return { status: res.status, json, text };
  };

  try {
    // ---------- envelope + health ----------
    let r = await call("GET", "/api/health");
    check("health envelope", r.status === 200 && r.json.success === true && r.json.data.status === "ok");

    // ---------- static frontend ----------
    r = await call("GET", "/");
    check("index.html served", r.status === 200 && r.text.includes("Ledger — Personal Finance Tracker"));
    check("index links css", r.text.includes('/css/style.css'));
    check("index links js", r.text.includes('/js/app.js'));
    r = await call("GET", "/css/style.css");
    check("css served", r.status === 200 && r.text.includes("--primary"));
    r = await call("GET", "/js/app.js");
    check("js served", r.status === 200 && r.text.includes("loadHome"));
    r = await call("GET", "/history");
    check("SPA fallback for /history", r.status === 200 && r.text.includes("app.js"));

    // ---------- auth token ----------
    r = await call("POST", "/api/auth/token");
    const token = r.json?.data?.token;
    check("token issued", r.status === 200 && typeof token === "string" && token.length > 20);
    const authHeaders = { Authorization: `Bearer ${token}` };

    // ---------- expenses CRUD ----------
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    r = await call("GET", "/api/expenses/today", undefined, authHeaders);
    check("today envelope", r.status === 200 && r.json.success === true && Array.isArray(r.json.data.expenses) && r.json.data.totalPaise === 0);
    check("today dateKey from server TZ", r.json.data.dateKey === today, r.json.data.dateKey);

    r = await call("POST", "/api/expenses", { title: "Lunch", amountPaise: 12050, dateKey: today, occurredAt: Date.now() }, authHeaders);
    check("create 201", r.status === 201 && r.json.data.amountPaise === 12050);
    const created = r.json.data;

    r = await call("POST", "/api/expenses", { title: "Coffee", amountRupees: "80.50", dateKey: today }, authHeaders);
    check("rupee-string create", r.status === 201 && r.json.data.amountPaise === 8050, JSON.stringify(r.json));
    const second = r.json.data;

    r = await call("GET", "/api/expenses/today", undefined, authHeaders);
    check("today total server-derived", r.json.data.totalPaise === 20100, "got " + r.json.data.totalPaise);
    check("today newest first", r.json.data.expenses[0].id === second.id);

    // ---------- validation errors via HTTP ----------
    r = await call("POST", "/api/expenses", { title: "X", amountPaise: 120.5, dateKey: today }, authHeaders);
    check("float amount -> 400 INVALID_AMOUNT", r.status === 400 && r.json.error.code === "INVALID_AMOUNT", JSON.stringify(r.json));
    r = await call("POST", "/api/expenses", { title: "", amountPaise: 100, dateKey: today }, authHeaders);
    check("empty title -> 400 TITLE_REQUIRED", r.status === 400 && r.json.error.code === "TITLE_REQUIRED");
    r = await call("POST", "/api/expenses", { title: "X", amountPaise: 100, dateKey: "junk" }, authHeaders);
    check("bad date -> 400 INVALID_DATE", r.status === 400 && r.json.error.code === "INVALID_DATE");
    r = await call("POST", "/api/expenses", undefined, authHeaders);
    check("no body -> 400", r.status === 400 && r.json.success === false);
    r = await fetch(base + "/api/expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{broken" });
    const brokenText = await r.text();
    const broken = JSON.parse(brokenText);
    check("malformed JSON -> 400 INVALID_JSON", r.status === 400 && broken.error.code === "INVALID_JSON", brokenText);

    // ---------- PATCH / DELETE ----------
    r = await call("PATCH", `/api/expenses/${created.id}`, { title: "Lunch edited", amountPaise: 13000, dateKey: today }, authHeaders);
    check("patch 200", r.status === 200 && r.json.data.amountPaise === 13000);
    r = await call("GET", "/api/expenses/today", undefined, authHeaders);
    check("today total after patch", r.json.data.totalPaise === 21050);

    r = await call("DELETE", `/api/expenses/${second.id}`, undefined, authHeaders);
    check("delete 200", r.status === 200 && r.json.data.deleted === true);
    r = await call("GET", "/api/expenses/today", undefined, authHeaders);
    check("total after delete", r.json.data.totalPaise === 13000);

    r = await call("PATCH", "/api/expenses/999999", { title: "X", amountPaise: 100, dateKey: today }, authHeaders);
    check("patch missing -> 404 NOT_FOUND", r.status === 404 && r.json.error.code === "NOT_FOUND");

    // ---------- ownership: a foreign token must not see or touch records ----------
    // Forge a token naming a user id that owns nothing (server-signed, so it
    // is accepted as a valid identity — but it owns no rows).
    const { issueToken } = await import("./services/auth.js");
    const foreign = issueToken(987654);
    r = await call("GET", "/api/expenses", undefined, { Authorization: `Bearer ${foreign}` });
    check("foreign user sees empty list", r.json.data.totalPaise === 0 && r.json.data.expenses.length === 0);
    r = await call("PATCH", `/api/expenses/${created.id}`, { title: "Steal", amountPaise: 1, dateKey: today }, { Authorization: `Bearer ${foreign}` });
    check("foreign user cannot patch", r.status === 404 && r.json.error.code === "NOT_FOUND");
    r = await call("DELETE", `/api/expenses/${created.id}`, undefined, { Authorization: `Bearer ${foreign}` });
    check("foreign user cannot delete", r.status === 404 && r.json.error.code === "NOT_FOUND");

    // ---------- income ----------
    r = await call("POST", "/api/income", { source: "Salary", amountPaise: 3000000, dateKey: today }, authHeaders);
    check("income create", r.status === 201 && r.json.data.amountPaise === 3000000);
    r = await call("GET", `/api/income?from=${today}&to=${today}`, undefined, authHeaders);
    check("income list + total", r.json.data.totalPaise === 3000000);

    // ---------- monthly overview + summary-only month ----------
    const month = today.slice(0, 7);
    r = await call("GET", `/api/monthly/overview?month=${month}`, undefined, authHeaders);
    const sel = r.json.data.selected;
    check("overview live totals", sel && sel.source === "detailed" && sel.totalExpensePaise === 13000 && sel.totalIncomePaise === 3000000);
    check("overview remaining", sel.remainingPaise === 2987000);
    check("overview days", r.json.data.days.length === 1 && r.json.data.days[0].totalPaise === 13000);

    r = await call("PUT", "/api/monthly/summaries/2026-08", { totalIncomePaise: 3000000, totalExpensePaise: 2970000, note: "Festival month" }, authHeaders);
    check("summary upsert", r.status === 200 && r.json.data.totalIncomePaise === 3000000 && r.json.data.totalExpensePaise === 2970000);
    r = await call("GET", "/api/monthly/overview?month=2026-08", undefined, authHeaders);
    check("summary month shows in history", r.json.data.selected.source === "summary" && r.json.data.selected.note === "Festival month");
    r = await call("DELETE", "/api/monthly/summaries/2026-08", undefined, authHeaders);
    check("summary delete", r.status === 200);
    r = await call("DELETE", "/api/monthly/summaries/2026-08", undefined, authHeaders);
    check("summary delete twice -> 404", r.status === 404 && r.json.error.code === "NOT_FOUND");

    // ---------- API 404 ----------
    r = await call("GET", "/api/nonexistent", undefined, authHeaders);
    check("unknown api -> 404 envelope", r.status === 404 && r.json.error.code === "NOT_FOUND");
  } catch (err) {
    fail++;
    console.log("FAIL unexpected exception:", err);
  }

  server.close();
  console.log("---");
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
});
