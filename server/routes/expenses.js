/**
 * Expense routes. HTTP concerns only: parse the request, hand to the service,
 * wrap the result in the API envelope. No business logic here.
 *
 * Every response is one of:
 *   { success: true, data: ... }
 *   { success: false, error: { message, code } }
 */
import { Router } from "express";

import * as expenses from "../services/expenses.js";

const router = Router();

/** GET /api/expenses/today — today's entries + total (server-defined today). */
router.get("/today", (req, res) => {
  res.json({ success: true, data: expenses.today(req.userId) });
});

/** GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD — inclusive range. */
router.get("/", (req, res) => {
  const { from, to } = req.query;
  res.json({ success: true, data: expenses.listBetween(req.userId, from, to) });
});

/** POST /api/expenses — create one expense. */
router.post("/", (req, res) => {
  const created = expenses.create(req.userId, req.body ?? {});
  res.status(201).json({ success: true, data: created });
});

/** PATCH /api/expenses/:id — edit one expense. */
router.patch("/:id", (req, res) => {
  const updated = expenses.update(req.userId, Number(req.params.id), req.body ?? {});
  res.json({ success: true, data: updated });
});

/** DELETE /api/expenses/:id — remove one expense. */
router.delete("/:id", (req, res) => {
  expenses.remove(req.userId, Number(req.params.id));
  res.json({ success: true, data: { deleted: true } });
});

export default router;
