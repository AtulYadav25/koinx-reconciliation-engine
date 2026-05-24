import mongoose from 'mongoose';
import { config } from '../config/env';
import { UserTransaction, IUserTransaction } from '../models/userTransaction.model';
import { ExchangeTransaction, IExchangeTransaction } from '../models/ExchangeTransaction.model';
import { ReconciliationRun, IReconciliationRun } from '../models/ReconciliationRun.model';
import { ReconciliationReport } from '../models/ReconciliationReportSchema.model';
import { ingestCsvFiles } from './ingestion.service';
import { normalizeAsset } from '../utils/assetAlias.util';

/**
 * Config overrides for a reconciliation run, supplied via POST body.
 */
export interface ReconcileConfig {
    timestampToleranceSeconds?: number;
    quantityTolerancePct?: number;
}

/**
 * Serialize a transaction document to a plain object for the report.
 */
function serializeTransaction(tx: IUserTransaction | IExchangeTransaction): Record<string, unknown> {
    return {
        transaction_id: tx.transaction_id,
        timestamp: tx.timestamp,
        type: tx.type,
        asset: tx.asset,
        quantity: tx.quantity,
        price_usd: tx.price_usd,
        fee: tx.fee,
        note: tx.note,
        flagged: tx.flagged,
        qualityIssues: tx.qualityIssues,
    };
}

/**
 * Run a full reconciliation: ingest CSVs → match transactions → generate report.
 *
 * @param overrides  Optional config overrides (timestamp tolerance, quantity tolerance)
 * @returns          The completed ReconciliationRun document
 */
export async function runReconciliation(
    overrides: ReconcileConfig = {}
): Promise<IReconciliationRun> {
    // --- Resolve configuration ---
    const timestampToleranceSeconds =
        overrides.timestampToleranceSeconds ?? config.TIMESTAMP_TOLERANCE_SECONDS;
    const quantityTolerancePct =
        overrides.quantityTolerancePct ?? config.QUANTITY_TOLERANCE_PCT;

    console.log(
        `🔧 Reconciliation config — timestamp: ±${timestampToleranceSeconds}s, quantity: ±${quantityTolerancePct}%`
    );

    // --- Create the run record ---
    const run = await ReconciliationRun.create({
        config: { timestampToleranceSeconds, quantityTolerancePct },
        status: 'processing',
        startedAt: new Date(),
    });

    try {
        // --- Phase 1: Ingest CSVs ---
        const ingestionResult = await ingestCsvFiles(run._id as mongoose.Types.ObjectId);

        run.ingestion = {
            totalUser: ingestionResult.totalUser,
            totalExchange: ingestionResult.totalExchange,
            flaggedUser: ingestionResult.flaggedUser,
            flaggedExchange: ingestionResult.flaggedExchange,
            errors: ingestionResult.errors,
        };
        await run.save();

        // --- Phase 2: Match transactions ---
        await matchTransactions(
            run._id as mongoose.Types.ObjectId,
            timestampToleranceSeconds,
            quantityTolerancePct
        );

        // --- Phase 3: Compute summary counts ---
        const [matched, conflicting, unmatchedUser, unmatchedExchange] = await Promise.all([
            ReconciliationReport.countDocuments({ runId: run._id, category: 'Matched' }),
            ReconciliationReport.countDocuments({ runId: run._id, category: 'Conflicting' }),
            ReconciliationReport.countDocuments({ runId: run._id, category: 'Unmatched-User' }),
            ReconciliationReport.countDocuments({ runId: run._id, category: 'Unmatched-Exchange' }),
        ]);

        run.summary = { matched, conflicting, unmatchedUser, unmatchedExchange };
        run.status = 'completed';
        run.completedAt = new Date();
        await run.save();

        console.log(
            `✅ Reconciliation complete — Matched: ${matched}, Conflicting: ${conflicting}, ` +
            `Unmatched-User: ${unmatchedUser}, Unmatched-Exchange: ${unmatchedExchange}`
        );

        return run;
    } catch (error) {
        run.status = 'failed';
        run.ingestion.errors.push((error as Error).message);
        await run.save();
        throw error;
    }
}

/**
 * Core matching algorithm.
 *
 * 1. Fetch all non-flagged transactions for this run
 * 2. For each exchange tx, find the best matching user tx by asset + type + timestamp + quantity
 * 3. Classify as Matched, Conflicting, or leave as unmatched
 * 4. Write flagged rows and remaining unmatched rows to the report
 */
async function matchTransactions(
    runId: mongoose.Types.ObjectId,
    timestampToleranceSeconds: number,
    quantityTolerancePct: number
): Promise<void> {
    // Fetch all transactions for this run
    const userTxs = await UserTransaction.find({ runId }).lean() as IUserTransaction[];
    const exchangeTxs = await ExchangeTransaction.find({ runId }).lean() as IExchangeTransaction[];

    // Separate flagged vs valid user transactions
    const validUserTxs = userTxs.filter((tx) => !tx.flagged);
    const flaggedUserTxs = userTxs.filter((tx) => tx.flagged);

    // Separate flagged vs valid exchange transactions
    const validExchangeTxs = exchangeTxs.filter((tx) => !tx.flagged);
    const flaggedExchangeTxs = exchangeTxs.filter((tx) => tx.flagged);

    // (Bucket) Build index: (asset|type) -> user txs sorted by timestamp
    type IndexedUserTx = {
        uIdx: number;
        tx: IUserTransaction;
        timestamp: number;
        quantity: number;
    };

    const userTxIndex = new Map<string, IndexedUserTx[]>();

    for (let uIdx = 0; uIdx < validUserTxs.length; uIdx++) {
        const uTx = validUserTxs[uIdx];
        if (!uTx.timestamp || !uTx.quantity) continue;

        // A single user tx may match under multiple type aliases (e.g. TRANSFER/WITHDRAWAL)
        // so we insert it under every normalized key it qualifies for.
        const keys = getTypeKeys(normalizeAsset(uTx.asset), uTx.type.toUpperCase());

        for (const key of keys) {
            if (!userTxIndex.has(key)) userTxIndex.set(key, []);
            userTxIndex.get(key)!.push({
                uIdx,
                tx: uTx,
                timestamp: new Date(uTx.timestamp).getTime(),
                quantity: Math.abs(uTx.quantity),
            });
        }
    }

    // Sort each bucket by timestamp for binary search
    for (const bucket of userTxIndex.values()) {
        bucket.sort((a, b) => a.timestamp - b.timestamp);
    }

    const matchedUserIndices = new Set<number>();
    const matchedExchangeIndices = new Set<number>();
    const reportEntries: Record<string, unknown>[] = [];

    // Match exchange txs using binary search
    for (let eIdx = 0; eIdx < validExchangeTxs.length; eIdx++) {
        const eTx = validExchangeTxs[eIdx];
        if (!eTx.timestamp || !eTx.quantity) continue;

        const eKey = getPrimaryKey(normalizeAsset(eTx.asset), eTx.type.toUpperCase());
        const bucket = userTxIndex.get(eKey);
        if (!bucket || bucket.length === 0) continue;

        const eTimestamp = new Date(eTx.timestamp).getTime();
        const eQuantity = Math.abs(eTx.quantity);

        // Binary search for closest timestamp
        const closestIdx = binarySearchClosest(bucket, eTimestamp);

        // Check a small window around the closest match (handles ties/duplicates)
        let bestMatch: { entry: IndexedUserTx; timeDiffSec: number; qtyDiffPct: number } | null = null;


        // Using +-2 window to prevent picking the same transaction multiple times
        for (let offset = -2; offset <= 2; offset++) {
            const i = closestIdx + offset;
            if (i < 0 || i >= bucket.length) continue;

            const entry = bucket[i];
            if (matchedUserIndices.has(entry.uIdx)) continue;

            const timeDiffSec = Math.abs(entry.timestamp - eTimestamp) / 1000;
            if (timeDiffSec > timestampToleranceSeconds * 2) continue; // skip obviously out-of-range

            const qtyDiffPct = eQuantity === 0
                ? 0
                : (Math.abs(entry.quantity - eQuantity) / eQuantity) * 100;

            if (!bestMatch || timeDiffSec < bestMatch.timeDiffSec) {
                bestMatch = { entry, timeDiffSec, qtyDiffPct };
            }
        }

        if (!bestMatch) continue;

        const withinTime = bestMatch.timeDiffSec <= timestampToleranceSeconds;
        const withinQty = bestMatch.qtyDiffPct <= quantityTolerancePct;

        if (withinTime && withinQty) {
            reportEntries.push({
                runId,
                category: 'Matched',
                reason: `Matched — timestamp diff: ${bestMatch.timeDiffSec}s, quantity diff: ${bestMatch.qtyDiffPct.toFixed(4)}%`,
                userTransaction: serializeTransaction(bestMatch.entry.tx),
                exchangeTransaction: serializeTransaction(eTx),
            });
        } else {
            const conflicts: string[] = [];
            if (!withinTime) conflicts.push(`timestamp diff ${bestMatch.timeDiffSec}s exceeds ±${timestampToleranceSeconds}s`);
            if (!withinQty) conflicts.push(`quantity diff ${bestMatch.qtyDiffPct.toFixed(4)}% exceeds ±${quantityTolerancePct}%`);

            reportEntries.push({
                runId,
                category: 'Conflicting',
                reason: `Conflicting — ${conflicts.join('; ')}`,
                userTransaction: serializeTransaction(bestMatch.entry.tx),
                exchangeTransaction: serializeTransaction(eTx),
            });
        }

        matchedUserIndices.add(bestMatch.entry.uIdx);
        matchedExchangeIndices.add(eIdx);
    }

    // --- Unmatched exchange transactions (valid but no user counterpart) ---
    for (let eIdx = 0; eIdx < validExchangeTxs.length; eIdx++) {
        if (matchedExchangeIndices.has(eIdx)) continue;

        reportEntries.push({
            runId,
            category: 'Unmatched-Exchange',
            reason: 'No matching user transaction found',
            userTransaction: null,
            exchangeTransaction: serializeTransaction(validExchangeTxs[eIdx]),
        });
    }

    // --- Unmatched user transactions (valid but no exchange counterpart) ---
    for (let uIdx = 0; uIdx < validUserTxs.length; uIdx++) {
        if (matchedUserIndices.has(uIdx)) continue;

        reportEntries.push({
            runId,
            category: 'Unmatched-User',
            reason: 'No matching exchange transaction found',
            userTransaction: serializeTransaction(validUserTxs[uIdx]),
            exchangeTransaction: null,
        });
    }

    // --- Flagged user transactions → Unmatched-User with data quality reasons ---
    for (const tx of flaggedUserTxs) {
        reportEntries.push({
            runId,
            category: 'Unmatched-User',
            reason: `Data quality issue: ${tx.qualityIssues.join(', ')}`,
            userTransaction: serializeTransaction(tx),
            exchangeTransaction: null,
        });
    }

    // --- Flagged exchange transactions → Unmatched-Exchange with data quality reasons ---
    for (const tx of flaggedExchangeTxs) {
        reportEntries.push({
            runId,
            category: 'Unmatched-Exchange',
            reason: `Data quality issue: ${tx.qualityIssues.join(', ')}`,
            userTransaction: null,
            exchangeTransaction: serializeTransaction(tx),
        });
    }

    // --- Bulk insert all report entries ---
    if (reportEntries.length > 0) {
        await ReconciliationReport.insertMany(reportEntries, { ordered: false });
    }
}

// If WITHDRAWAL ≡ TRANSFER, index under both
function getTypeKeys(asset: string, type: string): string[] {
    const keys = [`${asset}|${type}`];
    if (type === 'WITHDRAWAL') keys.push(`${asset}|TRANSFER`);
    if (type === 'TRANSFER') keys.push(`${asset}|WITHDRAWAL`);
    return keys;
}

// Exchange tx always uses a single lookup key
function getPrimaryKey(asset: string, type: string): string {
    return `${asset}|${type}`;
}

// Binary search: returns index of entry with closest timestamp
function binarySearchClosest(bucket: { timestamp: number }[], target: number): number {
    let lo = 0, hi = bucket.length - 1;

    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (bucket[mid].timestamp < target) lo = mid + 1;
        else hi = mid;
    }

    // Check neighbour in case it's closer
    if (lo > 0 && Math.abs(bucket[lo - 1].timestamp - target) < Math.abs(bucket[lo].timestamp - target)) {
        return lo - 1;
    }
    return lo;
}