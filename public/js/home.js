/**
 * Home page — "What did I spend today?"
 *
 * Fetches /api/expenses/today and renders the total + entry list. The server
 * decides what "today" is; this page only renders what it receives.
 */
import { api, ApiError } from "./api.js";
import { openExpenseDialog } from "./expenses.js";
import { $, show, hide, escapeHtml, confirmDelete, toast } from "./ui.js";
import {
  formatPaise,
  formatTime,
  formatDateKey,
  formatTodayLong,
  localDateKey,
} from "./utils.js";

const els = {
  date: $("#home-date"),
  total: $("#today-total"),
  meta: $("#today-meta"),
  monthMeta: $("#month-meta"),
  listTotal: $("#today-list-total"),
  skeleton: $("#today-skeleton"),
  empty: $("#today-empty"),
  error: $("#today-error"),
  errorMsg: $("#today-error-msg"),
  retry: $("#today-retry"),
  list: $("#today-list"),
  addBtn: $("#add-expense-btn"),
};

let todayData = null;
let monthMeta = null;

function renderEntry(expense) {
  const li = document.createElement("li");
  li.className = "row";
  li.innerHTML = `
    <div class="row-main">
      <p class="row-title">${escapeHtml(expense.title)}</p>
      <p class="row-sub tabular">${formatTime(expense.occurredAt)}</p>
    </div>
    <span class="row-amt tabular">${formatPaise(expense.amountPaise)}</span>
    <div class="row-actions">
      <button class="icon-btn" type="button" aria-label="Edit ${escapeHtml(expense.title)}" data-action="edit">✎</button>
      <button class="icon-btn" type="button" aria-label="Delete ${escapeHtml(expense.title)}" data-action="delete">✕</button>
    </div>`;
  li.querySelector('[data-action="edit"]').addEventListener("click", () => {
    openExpenseDialog({ entry: expense, defaultDateKey: todayData?.dateKey, onSavedCallback: load });
  });
  li.querySelector('[data-action="delete"]').addEventListener("click", () => {
    confirmDelete({
      text: `“${escapeHtml(expense.title)}” · <span class="tabular">${formatPaise(expense.amountPaise)}</span>
        will be removed from ${formatDateKey(expense.dateKey)}. This cannot be undone.`,
      onConfirm: async () => {
        await api.deleteExpense(expense.id);
        toast("Expense deleted");
        load();
      },
    });
  });
  return li;
}

function render() {
  if (!todayData) return;
  els.total.textContent = formatPaise(todayData.totalPaise);
  els.date.textContent = formatDateKey(todayData.dateKey, true);

  const count = todayData.expenses.length;
  els.meta.textContent =
    count === 0
      ? "No entries yet today"
      : `${count} ${count === 1 ? "entry" : "entries"} · ${formatDateKey(todayData.dateKey)}`;

  if (monthMeta) {
    show(els.monthMeta);
    let text = `This month so far: ${formatPaise(monthMeta.totalExpensePaise)}`;
    if (monthMeta.totalIncomePaise > 0) {
      text += ` · left ${formatPaise(monthMeta.remainingPaise)}`;
    }
    els.monthMeta.textContent = text;
  } else {
    hide(els.monthMeta);
  }

  hide(els.skeleton);
  hide(els.error);
  if (count === 0) {
    hide(els.list);
    hide(els.listTotal);
    show(els.empty);
  } else {
    hide(els.empty);
    els.listTotal.textContent = `Total ${formatPaise(todayData.totalPaise)}`;
    show(els.listTotal);
    els.list.replaceChildren(...todayData.expenses.map(renderEntry));
    show(els.list);
  }
}

export async function load() {
  show(els.skeleton);
  hide(els.empty);
  hide(els.error);
  hide(els.list);
  hide(els.listTotal);
  try {
    todayData = await api.today();
    // Month context is optional — the page works without it.
    try {
      const month = todayData.dateKey.slice(0, 7);
      const overview = await api.overview(month);
      monthMeta = overview.selected;
    } catch {
      monthMeta = null;
    }
    render();
  } catch (err) {
    hide(els.skeleton);
    hide(els.empty);
    els.errorMsg.textContent =
      err instanceof ApiError ? err.message : "Check your connection and try again.";
    show(els.error);
  }
}

els.addBtn.addEventListener("click", () => {
  openExpenseDialog({
    defaultDateKey: todayData?.dateKey ?? localDateKey(),
    onSavedCallback: load,
  });
});

els.retry.addEventListener("click", load);
