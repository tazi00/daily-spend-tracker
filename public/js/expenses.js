/**
 * Expense add/edit dialog — shared by Home (today) and History.
 *
 * One dialog for both jobs: prefilling from an existing entry turns it into
 * the edit form, so add and edit can never drift apart. Client validation is
 * UX only; the server re-validates everything.
 */
import { api } from "./api.js";
import { $, openDialog, toast } from "./ui.js";
import {
  formatPaise,
  formatDateKey,
  parseAmountToPaise,
  localDateKey,
  localTime,
  localEpoch,
} from "./utils.js";

const dialog = $("#expense-dialog");
const form = $("#expense-form");
const els = {
  title: dialog.querySelector("#expense-title"),
  amount: dialog.querySelector("#expense-amount"),
  date: dialog.querySelector("#expense-date"),
  time: dialog.querySelector("#expense-time"),
  error: dialog.querySelector("#expense-error"),
  submit: dialog.querySelector("#expense-submit"),
  titleLabel: dialog.querySelector("#expense-dialog-title"),
  sub: dialog.querySelector("#expense-dialog-sub"),
};

let editingId = null; // null → add mode
let pending = false;
/** Called after a successful create/edit so pages can refresh their data. */
let onSaved = () => {};

function setError(message) {
  els.error.textContent = message ?? "";
  els.error.hidden = !message;
}

function fill(entry, defaultDateKey) {
  if (entry) {
    els.titleLabel.textContent = "Edit expense";
    els.sub.textContent = "Correct the entry — today's total updates immediately.";
    els.submit.textContent = "Save changes";
    els.title.value = entry.title;
    els.amount.value = formatPaise(entry.amountPaise).replace("₹", "");
    els.date.value = entry.dateKey;
    // Keep the original time-of-day when the entry is still on its own day.
    const sameDay = entry.dateKey === defaultDateKey;
    const d = new Date(entry.occurredAt);
    els.time.value = sameDay
      ? `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      : localTime();
  } else {
    els.titleLabel.textContent = "Add expense";
    els.sub.textContent = "Where did today's money go?";
    els.submit.textContent = "Add expense";
    els.title.value = "";
    els.amount.value = "";
    els.date.value = defaultDateKey ?? localDateKey();
    els.time.value = localTime();
  }
}

export function openExpenseDialog({ entry = null, defaultDateKey = null, onSavedCallback = null } = {}) {
  editingId = entry ? entry.id : null;
  onSaved = onSavedCallback ?? (() => {});
  setError(null);
  fill(entry, defaultDateKey);
  openDialog(dialog);
  els.title.focus();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (pending) return; // duplicate-submit guard

  // UX-only validation; the server is authoritative.
  const title = els.title.value.trim();
  if (!title) return setError('Give it a short title, e.g. "Auto fare".');
  const paise = parseAmountToPaise(els.amount.value);
  if (paise === null) return setError("Enter a valid amount, like 120 or 120.50.");
  const dateKey = els.date.value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return setError("Pick a date.");
  const occurredAt = localEpoch(dateKey, els.time.value);
  if (!Number.isFinite(occurredAt)) return setError("Pick a valid time.");

  pending = true;
  els.submit.disabled = true;
  setError(null);
  try {
    const body = { title, amountPaise: paise, dateKey, occurredAt };
    if (editingId) {
      await api.updateExpense(editingId, body);
      toast("Expense updated");
    } else {
      await api.createExpense(body);
      toast("Expense added");
    }
    dialog.close();
    onSaved();
  } catch (err) {
    setError(err.message || "Something went wrong.");
  } finally {
    pending = false;
    els.submit.disabled = false;
  }
});
