# Ledger — Personal Finance Tracker

A simple personal finance tracker centered on one question: **what did I spend
today, and where did the money go?**

Open the app → see today's total → see every entry → add the next expense.
No charts, no jargon, no dashboards to decode.

## Stack

- **Frontend** — HTML, CSS, vanilla JavaScript (ES modules), no framework, no
  state library.
- **Backend** — Node.js + Express 5, REST + JSON.
- **Database** — SQLite via `better-sqlite3`, raw SQL, parameterized
  statements, WAL mode. No ORM.
- **Money** — integer paise everywhere (₹120.50 → `12050`). Floats are
  rejected at the validation layer; totals are derived from rows by the server.

```
Browser
  └── public/            static vanilla-JS app
        ├── index.html
        ├── css/
        └── js/
Server
  └── server/
        ├── routes/       HTTP: parse → service → envelope
        ├── services/     business rules + authoritative validation
        ├── repositories/ all SQL lives here
        ├── db/           connection + schema
        └── utils/        config, dates, validation helpers
```

## Setup

```bash
bun install             # or npm install
bun run dev             # node --watch server/server.js  (http://localhost:3000)
bun run smoke           # end-to-end verification script (node server/smoke.js)
```

Optional environment (see `.env.example`): `PORT`, `TZ` (server timezone —
defaults to `Asia/Kolkata`), `DB_PATH`, `AUTH_SECRET`, `STARTER_USER_EMAIL`.

## Where things live

**Finding things fast:**

- An expense is **created** in `server/services/expenses.js` → `create`,
  validated in `server/utils/validation.js`, persisted via
  `server/repositories/expenses.js`.
- Expenses are **fetched** by `expenses.today()` / `listBetween()` in the same
  service; routes live in `server/routes/expenses.js`.
- Today's list is **rendered** in `public/js/home.js`.
- Money rules (paise parse/format) live in `public/js/utils.js` (display only)
  and `server/utils/validation.js` (authoritative).
- All SQL lives in `server/repositories/*.js` — nothing else writes SQL.

## Data model

- **Money** — integer paise everywhere. The client parses `₹120.50` → `12050`
  for UX; the server re-validates (`INVALID_AMOUNT`, positive, safe integer,
  ≤ ₹1 crore). A float amount fails with 400 before it can reach SQLite.
- **Dates** — each record stores `dateKey` (`"YYYY-MM-DD"`, the calendar day
  the money moved) and `occurredAt` (epoch ms, for ordering and display).
  "Today" is computed **on the server** in the configured timezone, so a skewed
  device clock can't move saved entries to the wrong day.
- **Ownership** — every table is keyed by `user_id`; services check ownership
  before read/write. The MVP auth issues a signed HMAC token for the single
  starter user; requests fall back to the starter user without a token.
- **Indexes** — `(user_id, date_key)` for today/range scans and
  `(user_id, substr(date_key,1,7))` for monthly rollups; `UNIQUE (user_id,
  month_key)` on summaries.

## API overview

Every response is one of:

```
{ "success": true,  "data": ... }
{ "success": false, "error": { "message", "code" } }
```

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | liveness + server timezone |
| POST | `/api/auth/token` | MVP token for the starter user |
| GET | `/api/expenses/today` | today's entries + server-derived total |
| GET | `/api/expenses?from&to` | inclusive date-range scan |
| POST | `/api/expenses` | create (server validates) |
| PATCH | `/api/expenses/:id` | edit (ownership check) |
| DELETE | `/api/expenses/:id` | delete (ownership check) |
| GET | `/api/income?from&to` | income list + total |
| POST | `/api/income` | create (Salary / Freelance / Other) |
| PATCH/DELETE | `/api/income/:id` | edit / delete |
| GET | `/api/monthly/overview?month=YYYY-MM` | months, selected totals, per-day breakdown |
| PUT/DELETE | `/api/monthly/summaries/:monthKey` | summary-only month upsert/remove |

Error codes: `INVALID_AMOUNT`, `TITLE_REQUIRED`, `SOURCE_REQUIRED`,
`INVALID_DATE`, `INVALID_MONTH`, `INVALID_TIMESTAMP`, `INVALID_JSON`,
`NOT_FOUND`, `UNAUTHENTICATED`. Validation is authoritative on the server;
client checks exist only for fast feedback.

## Features

- **Today** — total spent, entry list, prominent **+ Spent** button,
  edit/delete with confirmation, loading/empty/error states, duplicate-submit
  guard.
- **History** — month chips, per-day grouped entries, income records with
  remaining = income − expenses, and **summary-only months** for the past
  ("income ₹30,000, expenses ₹29,700") without reconstructing transactions.
- **No carry-forward** — each month stands alone; last month's remaining is
  never auto-converted into this month's income (spec §5). A carry-forward
  feature would be explicit and opt-in.
- **Multi-device ready** — all state lives in SQLite on the server; the browser
  holds only transient UI state and talks to the REST API.

## Deliberate decisions

- **No ORM** — raw parameterized SQL in one repository layer; SQLite is fast
  enough that no pooling or caching layer is warranted.
- **No state library, no observer** — the URL decides the page, each page
  fetches and renders. A pub/sub would only appear if shared reactive state
  actually hurt.
- **One dialog for add + edit** — prefilling the same form keeps both paths
  from drifting apart.
- **Reminders / planned expenses** intentionally not built (spec §3 lists them
  as future); the schema leaves room without committing to a design.
