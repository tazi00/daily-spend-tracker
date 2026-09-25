/**
 * Monthly service — History domain logic.
 *
 * A month is either:
 *  - "detailed": it has expense/income records; totals are computed live
 *  - "summary": only a monthly_summaries row exists (e.g. "August 2026:
 *    income ₹30,000, expenses ₹29,700") — no transaction reconstruction needed
 *
 * No carry-forward: each month stands on its own. Previous month's remaining
 * is never treated as this month's income (that's a separate future concept).
 */
import * as expensesRepo from "../repositories/expenses.js";
import * as incomeRepo from "../repositories/income.js";
import * as summariesRepo from "../repositories/monthlySummaries.js";
import {
  ServiceError,
  validateMonthKey,
  validateAmount,
} from "../utils/validation.js";

/**
 * Everything History needs: the months that contain data, each month's
 * totals, and the per-day expense breakdown for the selected month.
 */
export function overview(userId, selectedMonth) {
  validateMonthKey(selectedMonth);

  const expenseRows = expensesRepo.findByUserAndDateRange(userId, "0000-01-01", "9999-12-31");
  const incomeRows = incomeRepo.findByUserAndDateRange(userId, "0000-01-01", "9999-12-31");
  const summaries = summariesRepo.listByUser(userId);

  // Months with detailed records. dateKey "YYYY-MM-DD" → month via slice(0,7)
  // — cheap string cut, and the user+month index covers this query pattern.
  const byMonth = new Map();
  for (const row of expenseRows) {
    const mk = row.dateKey.slice(0, 7);
    if (!byMonth.has(mk)) {
      byMonth.set(mk, { monthKey: mk, source: "detailed", totalIncomePaise: 0, totalExpensePaise: 0 });
    }
    byMonth.get(mk).totalExpensePaise += row.amountPaise;
  }
  for (const row of incomeRows) {
    const mk = row.dateKey.slice(0, 7);
    if (!byMonth.has(mk)) {
      byMonth.set(mk, { monthKey: mk, source: "detailed", totalIncomePaise: 0, totalExpensePaise: 0 });
    }
    byMonth.get(mk).totalIncomePaise += row.amountPaise;
  }

  // Summary-only months: only if no detailed records exist for that month.
  // (If a user later adds detailed entries, live totals take over.)
  for (const s of summaries) {
    if (!byMonth.has(s.monthKey)) {
      byMonth.set(s.monthKey, {
        monthKey: s.monthKey,
        source: "summary",
        totalIncomePaise: s.totalIncomePaise,
        totalExpensePaise: s.totalExpensePaise,
        note: s.note,
      });
    }
  }

  // Per-day breakdown for the selected month, newest day first.
  const days = new Map();
  for (const row of expenseRows) {
    if (row.dateKey.slice(0, 7) === selectedMonth) {
      days.set(row.dateKey, (days.get(row.dateKey) ?? 0) + row.amountPaise);
    }
  }

  const months = [...byMonth.values()]
    .map((m) => ({ ...m, remainingPaise: m.totalIncomePaise - m.totalExpensePaise }))
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));

  const selected = months.find((m) => m.monthKey === selectedMonth) ?? null;

  return {
    selectedMonth,
    months,
    selected,
    days: [...days.entries()]
      .map(([dateKey, totalPaise]) => ({ dateKey, totalPaise }))
      .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1)),
  };
}

/** Create or overwrite a summary-only month (for historical reconstruction). */
export function upsertSummary(userId, body) {
  const { monthKey, totalIncomePaise, totalExpensePaise } = body;
  validateMonthKey(monthKey);
  validateAmount(totalIncomePaise, { allowZero: true });
  validateAmount(totalExpensePaise, { allowZero: true });

  summariesRepo.upsert({
    userId,
    monthKey,
    totalIncomePaise,
    totalExpensePaise,
    note: typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 120) : null,
    now: Date.now(),
  });
  return summariesRepo.findByUserAndMonth(userId, monthKey);
}

export function removeSummary(userId, monthKey) {
  validateMonthKey(monthKey);
  const existing = summariesRepo.findByUserAndMonth(userId, monthKey);
  if (!existing) {
    throw new ServiceError("NOT_FOUND", "Summary not found", 404);
  }
  summariesRepo.remove(userId, monthKey);
}
