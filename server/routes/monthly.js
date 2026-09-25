/**
 * Monthly history routes.
 */
import { Router } from "express";

import * as monthly from "../services/monthly.js";

const router = Router();

/** GET /api/monthly/overview?month=YYYY-MM — months, totals, per-day breakdown. */
router.get("/overview", (req, res) => {
  const month = req.query.month;
  res.json({ success: true, data: monthly.overview(req.userId, month) });
});

/** PUT /api/monthly/summaries/:monthKey — create/overwrite a summary-only month. */
router.put("/summaries/:monthKey", (req, res) => {
  const updated = monthly.upsertSummary(req.userId, {
    monthKey: req.params.monthKey,
    totalIncomePaise: req.body?.totalIncomePaise,
    totalExpensePaise: req.body?.totalExpensePaise,
    note: req.body?.note,
  });
  res.json({ success: true, data: updated });
});

/** DELETE /api/monthly/summaries/:monthKey */
router.delete("/summaries/:monthKey", (req, res) => {
  monthly.removeSummary(req.userId, req.params.monthKey);
  res.json({ success: true, data: { deleted: true } });
});

export default router;
