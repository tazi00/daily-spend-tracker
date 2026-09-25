/**
 * App entry — decides which page controller to boot from the URL path.
 *
 * The server serves index.html for both / and /history; this file wires up
 * the right page. No router library — the URL is the state.
 */
import { saveToken, api } from "./api.js";
import { load as loadHome } from "./home.js";
import { load as loadHistory } from "./history.js";

// MVP identity: ask the server for a token for the starter user. Phase 5
// replaces this with a real sign-in; the API layer already sends it.
try {
  const res = await fetch("/api/auth/token", { method: "POST" });
  if (res.ok) {
    const payload = await res.json();
    if (payload?.success && payload.data?.token) saveToken(payload.data.token);
  }
} catch {
  // Token is optional for the MVP — the server falls back to the starter user.
}

const path = window.location.pathname;

if (path === "/history") {
  document.title = "History — Ledger";
  loadHistory();
} else {
  loadHome();
}
