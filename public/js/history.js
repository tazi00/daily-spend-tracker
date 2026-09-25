/**
 * History page — monthly view.
 *
 * Month chips → statement (live totals for detailed months, stored totals for
 * summary-only months) → per-day expense groups + income records. No
 * carry-forward: each month stands on its own.
 */
import { api } from "./api.js";
import { openExpenseDialog } from "./expenses.js";
import { $, show, hide, escapeHtml, confirmDelete, toast, openDialog } from "./ui.js";
import { formatPaise, formatMonthKey, formatDateKey, parseAmountToPaise } from "./utils.js";

const els = {
  chips: $("#month-chips"),
  // statement variants
  summaryCard: $("#statement-summary"),
  detailedCard: $("#statement-detailed"),
  summaryTitle: $("#summary-title"),
  summaryNote: $("#summary-note"),
  summaryIncome: $("#summary-income"),
  summaryExpenses: $("#summary-expenses"),
  summaryRemaining: $("#summary-remaining"),
  summaryDelete: $("#summary-delete-btn"),
  detailedTitle: $("#detailed-title"),
  detailedIncome: $("#detailed-income"),
  detailedExpenses: $("#detailed-expenses"),
  detailedRemaining: $("#detailed-remaining"),
  addIncome: $("#add-income-btn"),
  addSummary: $("#add-summary-btn"),
  // entries
  entriesSection: $("#history-entries-section"),
  entries: $("#history-entries"),
  empty: $("#history-empty"),
  emptyTitle: $("#history-empty-title"),
};

const incomeDialog = $("#income-dialog");
const incomeForm = $("#income-form");
const summaryDialog = $("#summary-dialog");
const summaryForm = $("#summary-form");

let selectedMonth = null;
let overview = null;
let monthExpenses = null;
let monthIncome = null;
let editingIncome = null;
let incomePending = false;

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderChips() {
  const months = overview ? overview.months.map((m) => m.monthKey) : [];
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  els.chips.replaceChildren(
    ...months.map((mk) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `chip tabular${mk === selectedMonth ? " active" : ""}`;
      btn.textContent = formatMonthKey(mk);
      btn.addEventListener("click", () => selectMonth(mk));
      return btn;
    }),
  );
  show(els.chips);
}

function renderStatement() {
  const selected = overview?.selected ?? null;

  if (selected && selected.source === "summary") {
    // Summary-only month: show stored totals, offer removal.
    hide(els.detailedCard);
    show(els.summaryCard);
    els.summaryTitle.textContent = `${formatMonthKey(selected.monthKey)} · summary only`;
    if (selected.note) {
      els.summaryNote.textContent = selected.note;
      show(els.summaryNote);
    } else {
      hide(els.summaryNote);
    }
    els.summaryIncome.textContent = formatPaise(selected.totalIncomePaise);
    els.summaryExpenses.textContent = formatPaise(selected.totalExpensePaise);
    els.summaryRemaining.textContent = formatPaise(selected.remainingPaise);
    els.summaryRemaining.classList.toggle("danger-text", selected.remainingPaise < 0);
    return;
  }

  hide(els.summaryCard);
  show(els.detailedCard);
  els.detailedTitle.textContent = formatMonthKey(selectedMonth);
  const incomePaise = monthIncome?.totalPaise ?? selected?.totalIncomePaise ?? 0;
  const expensePaise = monthExpenses?.totalPaise ?? selected?.totalExpensePaise ?? 0;
  els.detailedIncome.textContent = formatPaise(incomePaise);
  els.detailedExpenses.textContent = formatPaise(expensePaise);
  const remaining = incomePaise - expensePaise;
  els.detailedRemaining.textContent = formatPaise(remaining);
  els.detailedRemaining.classList.toggle("danger-text", remaining < 0);
}

function incomeRow(row) {
  const li = document.createElement("li");
  li.className = "row day-income";
  li.innerHTML = `
    <div class="row-main">
      <p class="row-title">${escapeHtml(row.source)}</p>
      <p class="row-sub tabular">${formatDateKey(row.dateKey)}</p>
    </div>
    <span class="row-amt tabular">+${formatPaise(row.amountPaise)}</span>
    <div class="row-actions">
      <button class="icon-btn" type="button" aria-label="Edit ${escapeHtml(row.source)}" data-action="edit">✎</button>
      <button class="icon-btn" type="button" aria-label="Delete ${escapeHtml(row.source)}" data-action="delete">✕</button>
    </div>`;
  li.querySelector('[data-action="edit"]').addEventListener("click", () => {
    editingIncome = row;
    fillIncomeForm();
    openDialog(incomeDialog);
  });
  li.querySelector('[data-action="delete"]').addEventListener("click", () => {
    confirmDelete({
      text: `“${escapeHtml(row.source)}” · <span class="tabular">${formatPaise(row.amountPaise)}</span>
        from ${formatDateKey(row.dateKey, true)} will be removed. This cannot be undone.`,
      onConfirm: async () => {
        await api.deleteIncome(row.id);
        toast("Income deleted");
        load();
      },
    });
  });
  return li;
}

function expenseRow(entry) {
  const li = document.createElement("li");
  li.className = "row";
  li.innerHTML = `
    <div class="row-main">
      <p class="row-title">${escapeHtml(entry.title)}</p>
    </div>
    <span class="row-amt tabular">${formatPaise(entry.amountPaise)}</span>
    <div class="row-actions">
      <button class="icon-btn" type="button" aria-label="Edit ${escapeHtml(entry.title)}" data-action="edit">✎</button>
      <button class="icon-btn" type="button" aria-label="Delete ${escapeHtml(entry.title)}" data-action="delete">✕</button>
    </div>`;
  li.querySelector('[data-action="edit"]').addEventListener("click", () => {
    openExpenseDialog({ entry, defaultDateKey: selectedMonth, onSavedCallback: load });
    // History edits land on the entry's own date, so default the date input
    // to the entry's dateKey rather than "today".
  });
  li.querySelector('[data-action="delete"]').addEventListener("click", () => {
    confirmDelete({
      text: `“${escapeHtml(entry.title)}” · <span class="tabular">${formatPaise(entry.amountPaise)}</span>
        from ${formatDateKey(entry.dateKey, true)} will be removed. This cannot be undone.`,
      onConfirm: async () => {
        await api.deleteExpense(entry.id);
        toast("Expense deleted");
        load();
      },
    });
  });
  return li;
}

function renderEntries() {
  const isSummaryOnly = overview?.selected?.source === "summary";
  if (isSummaryOnly) {
    hide(els.entriesSection);
    return;
  }
  show(els.entriesSection);

  const hasExpenses = (monthExpenses?.expenses.length ?? 0) > 0;
  const hasIncome = (monthIncome?.income.length ?? 0) > 0;
  if (!hasExpenses && !hasIncome) {
    els.emptyTitle.textContent = `Nothing recorded in ${formatMonthKey(selectedMonth)}`;
    show(els.empty);
    hide(els.entries);
    return;
  }
  hide(els.empty);
  els.entries.replaceChildren();

  if (hasIncome) {
    const panel = document.createElement("div");
    panel.className = "panel";
    const head = document.createElement("p");
    head.className = "label-caps day-head muted";
    head.textContent = "Income";
    const list = document.createElement("ul");
    list.className = "ruled";
    list.append(...monthIncome.income.map(incomeRow));
    panel.append(head, list);
    els.entries.append(panel);
  }

  // Group expenses by day, newest day first.
  const byDay = new Map();
  for (const e of monthExpenses?.expenses ?? []) {
    if (!byDay.has(e.dateKey)) byDay.set(e.dateKey, []);
    byDay.get(e.dateKey).push(e);
  }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  for (const [dateKey, entries] of days) {
    entries.sort((a, b) => b.occurredAt - a.occurredAt);
    const total = entries.reduce((sum, e) => sum + e.amountPaise, 0);
    const panel = document.createElement("div");
    panel.className = "panel";
    const head = document.createElement("div");
    head.className = "day-head";
    head.innerHTML = `<p class="label-caps muted">${formatDateKey(dateKey, true)}</p>
      <p class="tabular small muted">${formatPaise(total)}</p>`;
    const list = document.createElement("ul");
    list.className = "ruled";
    list.append(...entries.map(expenseRow));
    panel.append(head, list);
    els.entries.append(panel);
  }
}

/* ------------------------------------------------------------------ */
/* Data loading                                                        */
/* ------------------------------------------------------------------ */

async function loadData() {
  const first = `${selectedMonth}-01`;
  const [y, m] = selectedMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const last = `${selectedMonth}-${String(lastDay).padStart(2, "0")}`;

  [overview, monthExpenses, monthIncome] = await Promise.all([
    api.overview(selectedMonth),
    api.listExpenses(first, last),
    api.listIncome(first, last),
  ]);

  renderChips();
  renderStatement();
  renderEntries();
}

export async function load() {
  selectedMonth = new Date().toISOString().slice(0, 7);
  try {
    await loadData();
  } catch (err) {
    toast(err.message || "Could not load history.", "error");
  }
}

function selectMonth(mk) {
  selectedMonth = mk;
  loadData().catch((err) => toast(err.message || "Could not load history.", "error"));
}

/* ------------------------------------------------------------------ */
/* Income dialog                                                       */
/* ------------------------------------------------------------------ */

const incomeEls = {
  source: $("#income-source"),
  amount: $("#income-amount"),
  date: $("#income-date"),
  error: $("#income-error"),
  submit: $("#income-submit"),
  title: $("#income-dialog-title"),
};

function fillIncomeForm() {
  incomeEls.error.hidden = true;
  if (editingIncome) {
    incomeEls.title.textContent = "Edit income";
    incomeEls.submit.textContent = "Save changes";
    incomeEls.source.value = editingIncome.source;
    incomeEls.amount.value = formatPaise(editingIncome.amountPaise).replace("₹", "");
    incomeEls.date.value = editingIncome.dateKey;
  } else {
    incomeEls.title.textContent = "Add income";
    incomeEls.submit.textContent = "Add income";
    incomeEls.source.value = "Salary";
    incomeEls.amount.value = "";
    incomeEls.date.value = `${selectedMonth}-01`;
  }
}

incomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (incomePending) return;

  const paise = parseAmountToPaise(incomeEls.amount.value);
  if (paise === null) {
    incomeEls.error.textContent = "Enter a valid amount, like 30000 or 30000.50.";
    incomeEls.error.hidden = false;
    return;
  }
  const dateKey = incomeEls.date.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    incomeEls.error.textContent = "Pick a date.";
    incomeEls.error.hidden = false;
    return;
  }

  incomePending = true;
  incomeEls.submit.disabled = true;
  incomeEls.error.hidden = true;
  try {
    const body = {
      source: incomeEls.source.value,
      amountPaise: paise,
      dateKey,
      occurredAt: new Date(`${dateKey}T12:00`).getTime(),
    };
    if (editingIncome) {
      await api.updateIncome(editingIncome.id, body);
      toast("Income updated");
    } else {
      await api.createIncome(body);
      toast("Income added");
    }
    incomeDialog.close();
    load();
  } catch (err) {
    incomeEls.error.textContent = err.message || "Something went wrong.";
    incomeEls.error.hidden = false;
  } finally {
    incomePending = false;
    incomeEls.submit.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Summary-only month dialog                                           */
/* ------------------------------------------------------------------ */

const summaryEls = {
  month: $("#summary-month"),
  income: $("#summary-income-input"),
  expenses: $("#summary-expenses-input"),
  note: $("#summary-note-input"),
  error: $("#summary-error"),
  submit: $("#summary-submit"),
};

els.addSummary.addEventListener("click", () => {
  summaryEls.error.hidden = true;
  summaryForm.reset();
  summaryEls.month.value = selectedMonth;
  openDialog(summaryDialog);
});

summaryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (summaryEls.submit.disabled) return;

  const mk = summaryEls.month.value;
  if (!/^\d{4}-\d{2}$/.test(mk)) {
    summaryEls.error.textContent = "Pick a month.";
    summaryEls.error.hidden = false;
    return;
  }
  // Empty inputs mean 0 — a summary month may have only one side known.
  const parse = (value) => {
    const v = String(value).trim().replace(/[₹,\s]/g, "");
    if (v === "") return 0;
    return parseAmountToPaise(v);
  };
  const incomePaise = parse(summaryEls.income.value);
  const expensePaise = parse(summaryEls.expenses.value);
  if (incomePaise === null || expensePaise === null) {
    summaryEls.error.textContent = "Enter valid amounts, like 30000 or 30000.50.";
    summaryEls.error.hidden = false;
    return;
  }

  summaryEls.submit.disabled = true;
  summaryEls.error.hidden = true;
  try {
    await api.upsertSummary(mk, {
      totalIncomePaise: incomePaise,
      totalExpensePaise: expensePaise,
      note: summaryEls.note.value.trim() || undefined,
    });
    toast("Month summary saved");
    summaryDialog.close();
    selectMonth(mk);
  } catch (err) {
    summaryEls.error.textContent = err.message || "Something went wrong.";
    summaryEls.error.hidden = false;
  } finally {
    summaryEls.submit.disabled = false;
  }
});

/* ------------------------------------------------------------------ */
/* Wire-ups                                                            */
/* ------------------------------------------------------------------ */

els.addIncome.addEventListener("click", () => {
  editingIncome = null;
  fillIncomeForm();
  openDialog(incomeDialog);
});

els.summaryDelete.addEventListener("click", () => {
  const selected = overview?.selected;
  if (!selected || selected.source !== "summary") return;
  confirmDelete({
    text: `The summary for ${formatMonthKey(selected.monthKey)} will be removed. This cannot be undone.`,
    onConfirm: async () => {
      await api.deleteSummary(selected.monthKey);
      toast("Month summary removed");
      load();
    },
  });
});
