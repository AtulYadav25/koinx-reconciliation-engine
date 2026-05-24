import { Request, Response } from "express";
import mongoose from "mongoose";
import { runReconciliation } from "../services/reconcile.service";
import { ReconciliationRun } from "../models/ReconciliationRun.model";
import { ReconciliationReport } from "../models/ReconciliationReportSchema.model";
import { flattenTx, toCsv } from "../utils/csvHelper.util";

/**
 * POST /reconcile
 * Trigger a new reconciliation run.
 * Accepts optional config overrides in the request body:
 *   { timestampToleranceSeconds?: number, quantityTolerancePct?: number }
 */
export const triggerReconciliation = async (req: Request, res: Response): Promise<void> => {
    try {
        const { timestampToleranceSeconds, quantityTolerancePct } = req.body || {};

        const run = await runReconciliation({
            timestampToleranceSeconds:
                timestampToleranceSeconds !== undefined
                    ? Number(timestampToleranceSeconds)
                    : undefined,
            quantityTolerancePct:
                quantityTolerancePct !== undefined
                    ? Number(quantityTolerancePct)
                    : undefined,
        });

        res.status(200).json({
            success: true,
            message: 'Reconciliation completed successfully',
            data: {
                runId: run._id,
                status: run.status,
                config: run.config,
                summary: run.summary,
                ingestion: run.ingestion,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
            },
        });
    } catch (error) {
        console.error('❌ Reconciliation failed:', error);
        res.status(500).json({
            success: false,
            message: 'Reconciliation failed',
            error: (error as Error).message,
        });
    }
};

/**
 * GET /report/:runId
 * Fetch the full reconciliation report for a given run.
 */
export const getFullReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            res.status(400).json({ success: false, message: 'Invalid runId format' });
            return;
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            res.status(404).json({ success: false, message: 'Reconciliation run not found' });
            return;
        }

        const entries = await ReconciliationReport.find({ runId: run._id })
            .sort({ category: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: {
                runId: run._id,
                status: run.status,
                config: run.config,
                summary: run.summary,
                totalEntries: entries.length,
                entries,
            },
        });
    } catch (error) {
        console.error('❌ Failed to fetch report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch report',
            error: (error as Error).message,
        });
    }
};

/**
 * GET /report/:runId/summary
 * Fetch just the summary counts for a given run.
 */
export const getReportSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            res.status(400).json({ success: false, message: 'Invalid runId format' });
            return;
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            res.status(404).json({ success: false, message: 'Reconciliation run not found' });
            return;
        }

        res.status(200).json({
            success: true,
            data: {
                runId: run._id,
                status: run.status,
                summary: run.summary,
            },
        });
    } catch (error) {
        console.error('❌ Failed to fetch summary:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch summary',
            error: (error as Error).message,
        });
    }
};


/**
 * GET /report/:runId/unmatched
 * Fetch only unmatched rows (both user-only and exchange-only) with reasons.
 */
export const getUnmatched = async (req: Request, res: Response): Promise<void> => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            res.status(400).json({ success: false, message: 'Invalid runId format' });
            return;
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            res.status(404).json({ success: false, message: 'Reconciliation run not found' });
            return;
        }

        const entries = await ReconciliationReport.find({
            runId: run._id,
            category: { $in: ['Unmatched-User', 'Unmatched-Exchange'] },
        })
            .sort({ category: 1 })
            .lean();

        res.status(200).json({
            success: true,
            data: {
                runId: run._id,
                totalUnmatched: entries.length,
                unmatchedUser: entries.filter((e) => e.category === 'Unmatched-User').length,
                unmatchedExchange: entries.filter((e) => e.category === 'Unmatched-Exchange').length,
                entries,
            },
        });
    } catch (error) {
        console.error('❌ Failed to fetch unmatched:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unmatched entries',
            error: (error as Error).message,
        });
    }
};


/**
 * GET /report/:runId/csv
 * Download the full reconciliation report as a CSV file.
 *
 * Columns:
 *   category, reason,
 *   user_transaction_id … user_qualityIssues,
 *   exchange_transaction_id … exchange_qualityIssues
 */
export const downloadReportCsv = async (req: Request, res: Response): Promise<void> => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            res.status(400).json({ success: false, message: 'Invalid runId format' });
            return;
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            res.status(404).json({ success: false, message: 'Reconciliation run not found' });
            return;
        }

        const entries = await ReconciliationReport.find({ runId: run._id })
            .sort({ category: 1 })
            .lean();

        // Build flat row objects suitable for CSV serialization
        const rows = entries.map((entry) => ({
            category: entry.category,
            reason: entry.reason,
            ...flattenTx(entry.userTransaction as Record<string, unknown> | null, 'user_'),
            ...flattenTx(entry.exchangeTransaction as Record<string, unknown> | null, 'exchange_'),
        }));

        const csv = toCsv(rows);

        const filename = `reconciliation_report_${runId}.csv`;
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.status(200).send(csv);
    } catch (error) {
        console.error('❌ Failed to generate CSV report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate CSV report',
            error: (error as Error).message,
        });
    }
};