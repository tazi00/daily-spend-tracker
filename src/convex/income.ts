import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Income records — Salary / Freelance / Other (free-text source, validated
 * server-side). Same money and date conventions as expenses.
 */

const MAX_AMOUNT_PAISE = 1_000_000_000;

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

function validateSource(source: unknown): asserts source is string {
  if (typeof source !== "string" || source.trim().length === 0) {
    throw new Error("Source is required (SOURCE_REQUIRED)");
  }
  if (source.trim().length > 40) {
    throw new Error("Source is too long — 40 characters max (SOURCE_TOO_LONG)");
  }
}

function validateDateKey(dateKey: unknown): asserts dateKey is string {
  if (typeof dateKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    throw new Error("Invalid date (INVALID_DATE)");
  }
}

/** List income, optionally bounded by inclusive YYYY-MM-DD date keys. */
export const list = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, { from, to }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const rows = await ctx.db
      .query("income")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filtered = rows.filter(
      (r) => (!from || r.dateKey >= from) && (!to || r.dateKey <= to),
    );
    filtered.sort((a, b) => b.occurredAt - a.occurredAt);
    const totalPaise = filtered.reduce((sum, r) => sum + r.amountPaise, 0);
    return { income: filtered, totalPaise };
  },
});

export const create = mutation({
  args: {
    source: v.string(),
    amountPaise: v.number(),
    dateKey: v.string(),
    occurredAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    validateSource(args.source);
    validateAmount(args.amountPaise);
    validateDateKey(args.dateKey);
    if (args.occurredAt <= 0 || args.occurredAt > Date.now() + 60_000) {
      throw new Error("Invalid timestamp (INVALID_TIMESTAMP)");
    }

    const now = Date.now();
    return await ctx.db.insert("income", {
      userId,
      source: args.source.trim(),
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
    id: v.id("income"),
    source: v.string(),
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
      throw new Error("Income not found (NOT_FOUND)");
    }

    validateSource(fields.source);
    validateAmount(fields.amountPaise);
    validateDateKey(fields.dateKey);

    await ctx.db.patch(id, {
      source: fields.source.trim(),
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
  args: { id: v.id("income") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    const existing = await ctx.db.get(id);
    if (!existing || existing.userId !== userId) {
      throw new Error("Income not found (NOT_FOUND)");
    }
    await ctx.db.delete(id);
    return id;
  },
});
