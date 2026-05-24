import express from 'express';
import {
    getFullReport,
    getReportSummary,
    triggerReconciliation,
} from '../controllers/reconcile.controller';

const router = express.Router();

// POST /api/v1/reconcile — Trigger a new reconciliation run
router.post("/", triggerReconciliation);

// GET /api/v1/reconcile/report/:runId — Full report for a run
router.get("/report/:runId", getFullReport);

// GET /api/v1/reconcile/report/:runId/summary — Summary counts only
router.get("/report/:runId/summary", getReportSummary);

export default router;