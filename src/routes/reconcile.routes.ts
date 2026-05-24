import express from 'express';
import {
    triggerReconciliation,
} from '../controllers/reconcile.controller';

const router = express.Router();

// POST /api/v1/reconcile — Trigger a new reconciliation run
router.post("/", triggerReconciliation);

export default router;