import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Expenses — server-side business rules for the core flow:
 * see today's spending, add an expense, edit it, delete it.
 *
 * Validation lives here (not the client): the client validates only for UX.
 * All amounts are integer paise. "Today" is a local calendar date key
 * ("YYYY-MM-DD") computed by the server, so device clock skew cannot move an
 * expense to the wrong day after it is saved.
 */

const MAX_AMOUNT_PAISE = 1_000_000_000; // ₹1 crore per entry — sanity ceiling

/** Authoritative amount validation. Throws with a stable error code string. */
function validateAmount(amountPaise: unknown): asserts amountPaise is number {
  if (
    typeof amountPaise !== "number" ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise <= 0
  ) {
    throw new Error("Invalid amount: must be a positive amount in paise (INVALID_AMOUNT)");
  }
  if (amountPaise > MAX_AMOUNT_PAISE) {
    throw new Error("Invalid amount: exceeds the maximum allowed (INVALID_AMOUNT)");
  }
}

function validateTitle(title: unknown): asserts title is string {
  if (typeof title !== "string" || title.trim().length === 0) {
    throw new Error("Title is required (TITLE_REQUIRED)");
  }
  if (title.trim().length > 80) {
    throw new Error("Title is too long — 80 characters max (TITLE_TOO_LONG)");
  }
}

/** YYYY-MM-DD shape check (calendar correctness is not worth the code here). */
function validateDateKey(dateKey: unknown): asserts dateKey is string {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date (INVALID_DATE)");
  }
}

export const expenseFields = {
  title: v.string(),
  amountPaise: v.number(),
  dateKey: v.string(),
  occurredAt: v.number(),
  notes: v.optional(v.string()),
};

export const listArgs = {
  /** Inclusive "YYYY-MM-DD" lower bound. */
  from: v.optional(v.string()),
  /** Inclusive "YYYY-MM-DD" upper bound. */
  to: v.optional(v.string()),
};

/** Today's expenses, newest first. The server decides what "today" is. */
export const today = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const now = new Date();
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user_date", (q) => q.eq("userId", userId).eq("dateKey", dateKey))
      .collect();

    expenses.sort((a, b) => b.occurredAt - a.occurredAt);

    // Total derived from the rows — the database is the source of truth.
    const totalPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

    return { dateKey, expenses, totalPaise };
  },
});

/** A date range (inclusive). Used by History for a selected month. */
export const list = query({
  args: listArgs,
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filtered = expenses.filter(
      (e) => (!from || e.dateKey >= from) && (!to || e.dateKey <= to),
    );
    filtered.sort((a, b) => b.occurredAt - a.occurredAt);
    const totalPaise = filtered.reduce((sum, e) => sum + e.amountPaise, 0);

    return { expenses: filtered, totalPaise };
  },
});

export const create = mutation({
  args: expenseFields,
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    validateTitle(args.title);
    validateAmount(args.amountPaise);
    validateDateKey(args.dateKey);
    if (args.occurredAt <= 0 || args.occurredAt > Date.now() + 60_000) {
      throw new Error("Invalid timestamp (INVALID_TIMESTAMP)");
    }

    const now = Date.now();
    return await ctx.db.insert("expenses", {
      userId,
      title: args.title.trim(),
      amountPaise: args.amountPaise,
      dateKey: args.dateKey,
      occurredAt: args.occurredAt,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("expenses"),
    title: v.string(),
    amountPaise: v.number(),
    dateKey: v.string(),
    occurredAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Expense not found (NOT_FOUND)");
    }

    validateTitle(fields.title);
    validateAmount(fields.amountPaise);
    validateDateKey(fields.dateKey);

    await ctx.db.patch(id, {
      title: fields.title.trim(),
      amountPaise: fields.amountPaise,
      dateKey: fields.dateKey,
      occurredAt: fields.occurredAt,
      notes: fields.notes?.trim() || undefined,
      updatedAt: Date.now(),
    });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Expense not found (NOT_FOUND)");
    }
    await ctx.db.delete(id);
    return id;
  },
});
