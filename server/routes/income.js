/**
 * Income routes. Same envelope and conventions as expenses.
 */
import { Router } from "express";

import * as income from "../services/income.js";

const router = Router();

/** GET /api/income?from=YYYY-MM-DD&to=YYYY-MM-DD */
router.get("/", (req, res) => {
  const { from, to } = req.query;
  res.json({ success: true, data: income.listBetween(req.userId, from, to) });
});

/** POST /api/income */
router.post("/", (req, res) => {
  const created = income.create(req.userId, req.body ?? {});
  res.status(201).json({ success: true, data: created });
});

/** PATCH /api/income/:id */
router.patch("/:id", (req, res) => {
  const updated = income.update(req.userId, Number(req.params.id), req.body ?? {});
  res.json({ success: true, data: updated });
});

/** DELETE /api/income/:id */
router.delete("/:id", (req, res) => {
  income.remove(req.userId, Number(req.params.id));
  res.json({ success: true, data: { deleted: true } });
});

export default router;
