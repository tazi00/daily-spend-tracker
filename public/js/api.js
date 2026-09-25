/**
 * API client — the browser's single door to the server.
 *
 * The server answers { success: true, data } or { success: false, error }.
 * This wrapper unwraps successes and throws ApiError on failures so callers
 * can try/catch uniformly. The auth token rides along on every request.
 */
const TOKEN_KEY = "ledger_token";

export class ApiError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function token() {
  return localStorage.getItem(TOKEN_KEY);
}

export function saveToken(value) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
}

async function request(method, url, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token()) headers.Authorization = `Bearer ${token()}`;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    // Non-JSON response (e.g. a 500 HTML page) — synthesize the envelope.
    throw new ApiError("Server error", "INTERNAL", res.status);
  }

  if (!res.ok || !payload.success) {
    const err = payload?.error ?? {};
    throw new ApiError(
      err.message || "Something went wrong",
      err.code || "INTERNAL",
      res.status,
    );
  }
  return payload.data;
}

export const api = {
  health: () => request("GET", "/api/health"),
  // Expenses
  today: () => request("GET", "/api/expenses/today"),
  listExpenses: (from, to) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request("GET", `/api/expenses${suffix}`);
  },
  createExpense: (body) => request("POST", "/api/expenses", body),
  updateExpense: (id, body) => request("PATCH", `/api/expenses/${id}`, body),
  deleteExpense: (id) => request("DELETE", `/api/expenses/${id}`),
  // Income
  listIncome: (from, to) => {
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const suffix = qs.toString() ? `?${qs}` : "";
    return request("GET", `/api/income${suffix}`);
  },
  createIncome: (body) => request("POST", "/api/income", body),
  updateIncome: (id, body) => request("PATCH", `/api/income/${id}`, body),
  deleteIncome: (id) => request("DELETE", `/api/income/${id}`),
  // Monthly history
  overview: (month) => request("GET", `/api/monthly/overview?month=${encodeURIComponent(month)}`),
  upsertSummary: (monthKey, body) => request("PUT", `/api/monthly/summaries/${monthKey}`, body),
  deleteSummary: (monthKey) => request("DELETE", `/api/monthly/summaries/${monthKey}`),
};
