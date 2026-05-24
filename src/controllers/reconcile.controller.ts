import { Request, Response } from "express";
import mongoose from "mongoose";
import { runReconciliation } from "../services/reconcile.service";
import { ReconciliationRun } from "../models/ReconciliationRun.model";
import { ReconciliationReport } from "../models/ReconciliationReportSchema.model";
import { flattenTx, toCsv } from "../utils/csvHelper.util";
import { errorResponse, successResponse } from "../utils/responseHandler.util";

/**
 * POST /reconcile
 * Trigger a new reconciliation run.
 * Accepts optional config overrides in the request body:
 *   { timestampToleranceSeconds?: number, quantityTolerancePct?: number }
 */
export const triggerReconciliation = async (req: Request, res: Response) => {
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

        return successResponse(
            res,
            200,
            'Reconciliation completed successfully',
            {
                runId: run._id,
                status: run.status,
                config: run.config,
                summary: run.summary,
                ingestion: run.ingestion,
                startedAt: run.startedAt,
                completedAt: run.completedAt,
            }
        );
    } catch (error) {
        console.error('❌ Reconciliation failed:', error);
        return errorResponse(
            res,
            500,
            'Reconciliation failed',
            (error as Error).message
        );
    }
};

/**
 * GET /report/:runId
 * Fetch the full reconciliation report for a given run.
 */
export const getFullReport = async (req: Request, res: Response) => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            return errorResponse(res, 400, 'Invalid runId format');
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            return errorResponse(res, 404, 'Reconciliation run not found');
        }

        const entries = await ReconciliationReport.find({ runId: run._id })
            .sort({ category: 1 })
            .lean();

        return successResponse(res, 200, 'Report fetched successfully', {
            runId: run._id,
            status: run.status,
            config: run.config,
            summary: run.summary,
            totalEntries: entries.length,
            entries,
        },
        );
    } catch (error) {
        console.error('❌ Failed to fetch report:', error);
        return errorResponse(
            res,
            500,
            'Failed to fetch report',
            (error as Error).message
        );
    }
};

/**
 * GET /report/:runId/summary
 * Fetch just the summary counts for a given run.
 */
export const getReportSummary = async (req: Request, res: Response) => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            return errorResponse(res, 400, 'Invalid runId format');
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            return errorResponse(res, 404, 'Reconciliation run not found');
        }

        return successResponse(res, 200, 'Summary fetched successfully', {
            runId: run._id,
            status: run.status,
            summary: run.summary,
        });
    } catch (error) {
        console.error('❌ Failed to fetch summary:', error);
        return errorResponse(
            res,
            500,
            'Failed to fetch summary',
            (error as Error).message
        );
    }
};


/**
 * GET /report/:runId/unmatched
 * Fetch only unmatched rows (both user-only and exchange-only) with reasons.
 */
export const getUnmatched = async (req: Request, res: Response) => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            return errorResponse(res, 400, 'Invalid runId format');
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            return errorResponse(res, 404, 'Reconciliation run not found');
        }

        const entries = await ReconciliationReport.find({
            runId: run._id,
            category: { $in: ['Unmatched-User', 'Unmatched-Exchange'] },
        })
            .sort({ category: 1 })
            .lean();

        return successResponse(res, 200, 'Unmatched entries fetched successfully', {
            runId: run._id,
            totalUnmatched: entries.length,
            unmatchedUser: entries.filter((e) => e.category === 'Unmatched-User').length,
            unmatchedExchange: entries.filter((e) => e.category === 'Unmatched-Exchange').length,
            entries,
        });
    } catch (error) {
        console.error('❌ Failed to fetch unmatched:', error);
        errorResponse(
            res,
            500,
            'Failed to fetch unmatched entries',
            (error as Error).message
        );
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
export const downloadReportCsv = async (req: Request, res: Response) => {
    try {
        const runId = req.params.runId as string;

        if (!runId || !mongoose.Types.ObjectId.isValid(runId)) {
            return errorResponse(res, 400, 'Invalid runId format');
        }

        const run = await ReconciliationRun.findById(runId);
        if (!run) {
            return errorResponse(res, 404, 'Reconciliation run not found');
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

        return res.status(200).attachment(`reconciliation_report_${runId}.csv`)
            .type("text/csv")
            .send(csv);

    } catch (err) {
        return errorResponse(
            res,
            500,
            "Failed to generate CSV report",
            (err as Error).message
        );
    }
};