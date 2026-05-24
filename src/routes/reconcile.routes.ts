import express from 'express';
import {
    getFullReport,
    getReportSummary,
    getUnmatched,
    triggerReconciliation,
    downloadReportCsv
} from '../controllers/reconcile.controller';

const router = express.Router();

// POST /api/v1/reconcile — Trigger a new reconciliation run
router.post("/", triggerReconciliation);

// GET /api/v1/reconcile/report/:runId — Full report for a run
router.get("/report/:runId", getFullReport);

// GET /api/v1/reconcile/report/:runId/summary — Summary counts only
router.get("/report/:runId/summary", getReportSummary);

// GET /api/v1/reconcile/report/:runId/unmatched — Unmatched rows only
router.get("/report/:runId/unmatched", getUnmatched);

// GET /api/v1/reconcile/report/:runId/csv — Full report as downloadable CSV
router.get("/report/:runId/csv", downloadReportCsv);

export default router;