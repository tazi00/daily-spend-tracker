import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Summary-only historical months (spec §4). One row per user per "YYYY-MM".
 * Detailed months don't need a row — their totals are computed live from
 * expenses/income records.
 */

function validateMonthKey(monthKey: unknown): asserts monthKey is string {
  if (typeof monthKey !== "string" || !/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("Invalid month (INVALID_MONTH)");
  }
}

function validateAmount(amountPaise: unknown): asserts amountPaise is number {
  if (
    typeof amountPaise !== "number" ||
    !Number.isSafeInteger(amountPaise) ||
    amountPaise < 0
  ) {
    throw new Error("Invalid amount: must be zero or more paise (INVALID_AMOUNT)");
  }
}

/**
 * Everything needed to render History in one call: the list of months that
 * contain data (detailed months from record dates, summary months from rows),
 * each month's totals, and per-day expense breakdowns for the selected month.
 */
export const overview = query({
  args: { selectedMonth: v.string() },
  handler: async (ctx, { selectedMonth }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    validateMonthKey(selectedMonth);

    const [expenseRows, incomeRows, summaries] = await Promise.all([
      ctx.db.query("expenses").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("income").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("monthlySummaries").withIndex("by_user_month", (q) => q.eq("userId", userId)).collect(),
    ]);

    // Months with detailed records. No carry-forward: each month stands alone.
    const monthSet = new Set<string>();
    for (const row of expenseRows) monthSet.add(row.dateKey.slice(0, 7));
    for (const row of incomeRows) monthSet.add(row.dateKey.slice(0, 7));

    type MonthEntry = {
      monthKey: string;
      source: "detailed" | "summary";
      totalIncomePaise: number;
      totalExpensePaise: number;
      remainingPaise: number;
      note?: string;
    };

    const byMonth = new Map<string, MonthEntry>();
    for (const mk of monthSet) {
      byMonth.set(mk, {
        monthKey: mk,
        source: "detailed",
        totalIncomePaise: 0,
        totalExpensePaise: 0,
        remainingPaise: 0,
      });
    }
    for (const s of summaries) {
      if (!byMonth.has(s.monthKey)) {
        byMonth.set(s.monthKey, {
          monthKey: s.monthKey,
          source: "summary",
          totalIncomePaise: s.totalIncomePaise,
          totalExpensePaise: s.totalExpensePaise,
          remainingPaise: s.totalIncomePaise - s.totalExpensePaise,
          note: s.note,
        });
      }
    }

    const daysOfSelected: { dateKey: string; totalPaise: number }[] = [];
    const daysMap = new Map<string, number>();
    for (const row of expenseRows) {
      const mk = row.dateKey.slice(0, 7);
      const entry = byMonth.get(mk);
      if (entry && entry.source === "detailed") {
        entry.totalExpensePaise += row.amountPaise;
        if (mk === selectedMonth) {
          daysMap.set(row.dateKey, (daysMap.get(row.dateKey) ?? 0) + row.amountPaise);
        }
      }
    }
    for (const row of incomeRows) {
      const entry = byMonth.get(row.dateKey.slice(0, 7));
      if (entry && entry.source === "detailed") {
        entry.totalIncomePaise += row.amountPaise;
      }
    }
    for (const [dateKey, totalPaise] of daysMap) {
      daysOfSelected.push({ dateKey, totalPaise });
    }
    daysOfSelected.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
    for (const entry of byMonth.values()) {
      entry.remainingPaise = entry.totalIncomePaise - entry.totalExpensePaise;
    }

    const months = [...byMonth.values()].sort((a, b) =>
      a.monthKey < b.monthKey ? 1 : -1,
    );
    const selected = months.find((m) => m.monthKey === selectedMonth) ?? null;

    return {
      months,
      selected,
      days: daysOfSelected,
      selectedMonth,
    };
  },
});

/** Create or overwrite a summary-only month (for historical reconstruction). */
export const upsertSummary = mutation({
  args: {
    monthKey: v.string(),
    totalIncomePaise: v.number(),
    totalExpensePaise: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { monthKey, totalIncomePaise, totalExpensePaise, note }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    validateMonthKey(monthKey);
    validateAmount(totalIncomePaise);
    validateAmount(totalExpensePaise);

    const existing = await ctx.db
      .query("monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey),
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        totalIncomePaise,
        totalExpensePaise,
        note: note?.trim() || undefined,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("monthlySummaries", {
      userId,
      monthKey,
      totalIncomePaise,
      totalExpensePaise,
      note: note?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const removeSummary = mutation({
  args: { monthKey: v.string() },
  handler: async (ctx, { monthKey }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not signed in (UNAUTHENTICATED)");

    const existing = await ctx.db
      .query("monthlySummaries")
      .withIndex("by_user_month", (q) =>
        q.eq("userId", userId).eq("monthKey", monthKey),
      )
      .unique();
    if (!existing) throw new Error("Summary not found (NOT_FOUND)");
    await ctx.db.delete(existing._id);
    return existing._id;
  },
});
