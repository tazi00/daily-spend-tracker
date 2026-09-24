# Ledger — Personal Finance Tracker

A simple personal finance tracker centered on one question: **what did I spend
today, and where did the money go?**

Open the app → see today's total → see every entry → add the next expense.
No charts, no jargon, no dashboards to decode.

Built on the Freebuff web stack: **React + Vite** frontend, **Convex**
backend/database (server-managed), **Tailwind CSS 4 + shadcn/ui** styling.
Amounts are stored and computed as **integer paise** (₹120.50 → `12050`), so
totals are always exact.

## Setup

No local database or env vars needed — the Convex deployment is provisioned by
the platform and the app connects via `VITE_CONVEX_URL`.

```bash
bun install        # install dependencies
bun run dev        # dev server (managed by the platform preview)
```

Useful commands:

| Command | Purpose |
| --- | --- |
| `bun tsc -b --noEmit` | typecheck the whole project |
| `bun convex dev --once` | push Convex functions + regenerate `_generated` types |
| `bun run lint` | eslint |

## Where things live

```
src/
├── convex/
│   ├── schema.ts        # expenses, income, monthlySummaries tables + indexes
│   ├── expenses.ts      # today/list queries, create/update/remove mutations
│   ├── income.ts        # list + create/update/remove for income records
│   └── monthly.ts       # month overview + summary-only month upsert/remove
├── lib/
│   └── money.ts         # paise math, formatting, date/month keys
├── components/finance/
│   └── ExpenseDialog.tsx# add/edit expense form (shared by Today and History)
└── pages/
    ├── Landing.tsx      # public landing page
    ├── Dashboard.tsx    # Today — total, entries, add/edit/delete
    ├── History.tsx      # months, income, summary-only months
    └── Auth.tsx         # sign-in (email OTP or guest)
```

**Finding things fast:**

- An expense is **created** in `src/convex/expenses.ts` → `create` (mutation).
- Expenses are **fetched** by `expenses.today` / `expenses.list` (same file).
- Today's list is **rendered** in `src/pages/Dashboard.tsx` (`LedgerRow`).
- All DB access lives in `src/convex/*` — the frontend never touches storage
  directly; it calls queries/mutations through Convex's typed client.
- Money rules (paise conversion, formatting) live in `src/lib/money.ts`.

## Data model

- **Money** — integer paise everywhere. Client parses `₹120.50` → `12050` for
  UX; the server re-validates (`INVALID_AMOUNT`, positive, safe integer).
- **Dates** — each record stores `dateKey` (`"YYYY-MM-DD"`, the calendar day
  the money moved) and `occurredAt` (epoch ms, for ordering and display).
  "Today" is computed **on the server**, so a skewed device clock can't move
  saved entries to the wrong day.
- **Ownership** — every table is keyed by `userId` and every query/mutation
  checks the signed-in user; you only ever see your own ledger.
- **Indexes** — `by_user_date` (today/month lookups), `by_user`
  (range scans), `by_user_month` (summaries).

## API overview

Convex functions replace the classic REST routes; the shape maps 1:1:

| Spec endpoint | Convex function | Notes |
| --- | --- | --- |
| `GET /api/expenses/today` | `expenses.today` | returns `{ dateKey, expenses, totalPaise }` |
| `GET /api/expenses` | `expenses.list` | optional inclusive `from`/`to` date keys |
| `POST /api/expenses` | `expenses.create` | server-side validation |
| `PATCH /api/expenses/:id` | `expenses.update` | ownership check |
| `DELETE /api/expenses/:id` | `expenses.remove` | ownership check |
| `GET /api/income` | `income.list` | optional `from`/`to` |
| `POST /api/income` | `income.create` | Salary / Freelance / Other |
| — | `monthly.overview` | months list, selected month totals, day breakdown |
| — | `monthly.upsertSummary` / `removeSummary` | summary-only months |

Errors are thrown server-side with a stable code in the message
(`INVALID_AMOUNT`, `TITLE_REQUIRED`, `NOT_FOUND`, `UNAUTHENTICATED`), which the
UI strips before displaying. Validation is authoritative on the server; client
checks exist only for fast feedback.

## Features

- **Today** — total spent, entry list, prominent *Spent money* button,
  edit/delete with confirmation, loading/empty/error states, duplicate-submit
  guard.
- **History** — month chips, per-day grouped entries, income records with
  remaining = income − expenses, and **summary-only months** for the past
  ("income ₹30,000, expenses ₹29,700") without reconstructing transactions.
- **No carry-forward** — each month stands alone; last month's remaining is
  never auto-converted into this month's income (per spec §5). A carry-forward
  feature would be explicit and opt-in.
- **Multi-device ready** — all state lives in the Convex database; the client
  holds only temporary UI state and renders reactive subscriptions.

## Deliberate decisions

- **Convex instead of Express + SQLite** — the hosting environment runs the
  Next-gen Freebuff stack where Convex is the managed backend/database; a
  separate Node/Express process isn't hosted. The spec's architecture
  (thin client, authoritative server validation, parameterized access, source
  of truth on the server) is preserved; Convex queries/mutations + integer
  paise give the same guarantees with less code.
- **No ORM, no state library** — direct typed table access and plain React
  state, matching the "boring, understandable solution" principle. A store /
  observer layer would only be introduced if shared reactive state actually
  hurt (Convex subscriptions already cover the reactive case).
- **One dialog for add + edit** — prefilling the same form keeps both paths
  from drifting apart.
- **Reminders / planned expenses** intentionally not built (spec §3 lists them
  as future); the schema leaves room (`reminders` table) without committing to
  a design.
