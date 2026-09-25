/**
 * UI helpers — tiny DOM utilities shared by the page controllers.
 * No framework: query, escape, show/hide, dialogs, toast, confirm.
 */

export function $(selector) {
  return document.querySelector(selector);
}

/** Escape text before inserting user content into innerHTML. */
export function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = String(text);
  return div.innerHTML;
}

export function show(el) {
  el.hidden = false;
}

export function hide(el) {
  el.hidden = true;
}

/** Open a <dialog> and wire its Cancel buttons + backdrop click to close. */
export function openDialog(dialog) {
  if (!dialog.dataset.wired) {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
    for (const btn of dialog.querySelectorAll("[data-close]")) {
      btn.addEventListener("click", () => dialog.close());
    }
    dialog.dataset.wired = "1";
  }
  dialog.showModal();
}

/* ---------- toast ---------- */

let toastTimer = null;

export function toast(message, kind = "ok") {
  const el = $("#toast");
  el.textContent = message;
  el.classList.toggle("toast-error", kind === "error");
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => hide(el), 2600);
}

/* ---------- delete confirmation ---------- */

/**
 * One shared confirm dialog. `onConfirm` runs with duplicate-submit guarding;
 * return a promise. The dialog closes on success, stays open on failure so
 * the user can retry.
 */
export function confirmDelete({ text, confirmLabel = "Delete", onConfirm }) {
  const dialog = $("#confirm-dialog");
  $("#confirm-text").innerHTML = text;
  const btn = $("#confirm-delete");
  btn.textContent = confirmLabel;

  btn.onclick = async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    btn.textContent = "Deleting…";
    try {
      await onConfirm();
      dialog.close();
    } catch (err) {
      toast(err.message || "Could not delete — try again.", "error");
    } finally {
      btn.disabled = false;
      btn.textContent = confirmLabel;
    }
  };

  openDialog(dialog);
}
