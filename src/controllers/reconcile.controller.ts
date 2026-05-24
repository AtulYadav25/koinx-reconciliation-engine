import { Request, Response } from "express";
import { runReconciliation } from "../services/reconcile.service";

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
