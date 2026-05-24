import path from 'path';
import mongoose from 'mongoose';
import { parseCsvFile, RawCsvRow } from '../utils/csvParser.util';
import { normalizeAsset } from '../utils/assetAlias.util';
import { UserTransaction } from '../models/userTransaction.model';
import { ExchangeTransaction } from '../models/ExchangeTransaction.model';

/**
 * Result of ingesting both CSV files for a reconciliation run.
 */
export interface IngestionResult {
    totalUser: number;
    totalExchange: number;
    flaggedUser: number;
    flaggedExchange: number;
    errors: string[];
}

/**
 * Validate a raw CSV row and return the parsed document + any quality issues.
 */
function validateRow(
    row: RawCsvRow,
    source: 'user' | 'exchange',
    seenIds: Set<string>
): { doc: Record<string, unknown>; issues: string[] } {
    const issues: string[] = [];

    // --- transaction_id ---
    const txId = (row.transaction_id || '').trim();
    if (!txId) {
        issues.push('Missing transaction_id');
    } else if (seenIds.has(txId)) {
        issues.push(`Duplicate transaction_id: ${txId}`);
    }
    seenIds.add(txId);

    // --- timestamp ---
    let timestamp: Date | null = null;
    const rawTimestamp = (row.timestamp || '').trim();
    if (!rawTimestamp) {
        issues.push('Missing timestamp');
    } else {
        const parsed = new Date(rawTimestamp);
        if (isNaN(parsed.getTime())) {
            issues.push(`Malformed timestamp: "${rawTimestamp}"`);
        } else {
            timestamp = parsed;
        }
    }

    // --- type ---
    const type = (row.type || '').trim().toUpperCase();
    if (!type) {
        issues.push('Missing transaction type');
    }

    // --- asset ---
    const rawAsset = (row.asset || '').trim();
    if (!rawAsset) {
        issues.push('Missing asset');
    }
    const asset = normalizeAsset(rawAsset);

    // --- quantity ---
    let quantity: number | null = null;
    const rawQuantity = (row.quantity || '').trim();
    if (!rawQuantity) {
        issues.push('Missing quantity');
    } else {
        const parsed = parseFloat(rawQuantity);
        if (isNaN(parsed)) {
            issues.push(`Invalid quantity: "${rawQuantity}"`);
        } else if (parsed < 0) {
            issues.push(`Negative quantity: ${parsed}`);
            quantity = parsed; // Store the value but flag it
        } else {
            quantity = parsed;
        }
    }

    // --- price_usd ---
    let priceUsd: number | null = null;
    const rawPrice = (row.price_usd || '').trim();
    if (rawPrice) {
        const parsed = parseFloat(rawPrice);
        if (isNaN(parsed)) {
            issues.push(`Invalid price_usd: "${rawPrice}"`);
        } else {
            priceUsd = parsed;
        }
    }
    // price_usd can be empty for transfers — not flagged

    // --- fee ---
    let fee: number | null = null;
    const rawFee = (row.fee || '').trim();
    if (rawFee) {
        const parsed = parseFloat(rawFee);
        if (isNaN(parsed)) {
            issues.push(`Invalid fee: "${rawFee}"`);
        } else {
            fee = parsed;
        }
    }

    // --- note ---
    const note = (row.note || '').trim();

    const doc: Record<string, unknown> = {
        transaction_id: txId,
        timestamp,
        type,
        asset,
        quantity,
        price_usd: priceUsd,
        fee,
        note,
        raw: { ...row },
        flagged: issues.length > 0,
        qualityIssues: issues,
    };

    return { doc, issues };
}

/**
 * Ingest both CSV files for a given reconciliation run.
 *
 * - Parses user_transactions.csv and exchange_transactions.csv
 * - Validates every row and flags data quality issues
 * - Stores all rows in MongoDB (bad rows are flagged, never silently dropped)
 * - Returns ingestion statistics
 */
export async function ingestCsvFiles(
    runId: mongoose.Types.ObjectId
): Promise<IngestionResult> {
    const result: IngestionResult = {
        totalUser: 0,
        totalExchange: 0,
        flaggedUser: 0,
        flaggedExchange: 0,
        errors: [],
    };

    // --- Parse user transactions CSV ---
    const userCsvPath = path.resolve(__dirname, '..', 'user_transactions.csv');
    let userRows: RawCsvRow[];
    try {
        userRows = parseCsvFile(userCsvPath);
    } catch (err) {
        const msg = `Failed to parse user CSV: ${(err as Error).message}`;
        result.errors.push(msg);
        console.error(msg);
        userRows = [];
    }

    // --- Parse exchange transactions CSV ---
    const exchangeCsvPath = path.resolve(__dirname, '..', 'exchange_transactions.csv');
    let exchangeRows: RawCsvRow[];
    try {
        exchangeRows = parseCsvFile(exchangeCsvPath);
    } catch (err) {
        const msg = `Failed to parse exchange CSV: ${(err as Error).message}`;
        result.errors.push(msg);
        console.error(msg);
        exchangeRows = [];
    }

    // --- Validate and store user transactions ---
    const userSeenIds = new Set<string>();
    const userDocs: Record<string, unknown>[] = [];

    for (const row of userRows) {
        const { doc, issues } = validateRow(row, 'user', userSeenIds);
        doc.runId = runId;
        userDocs.push(doc);

        if (issues.length > 0) {
            result.flaggedUser++;
            console.log(`⚠️  User row flagged [${doc.transaction_id}]: ${issues.join(', ')}`);
        }
    }
    result.totalUser = userDocs.length;

    if (userDocs.length > 0) {
        await UserTransaction.insertMany(userDocs, { ordered: false });
    }

    // --- Validate and store exchange transactions ---
    const exchangeSeenIds = new Set<string>();
    const exchangeDocs: Record<string, unknown>[] = [];

    for (const row of exchangeRows) {
        const { doc, issues } = validateRow(row, 'exchange', exchangeSeenIds);
        doc.runId = runId;
        exchangeDocs.push(doc);

        if (issues.length > 0) {
            result.flaggedExchange++;
            console.log(`⚠️  Exchange row flagged [${doc.transaction_id}]: ${issues.join(', ')}`);
        }
    }
    result.totalExchange = exchangeDocs.length;

    if (exchangeDocs.length > 0) {
        await ExchangeTransaction.insertMany(exchangeDocs, { ordered: false });
    }

    console.log(
        `📊 Ingestion complete — User: ${result.totalUser} rows (${result.flaggedUser} flagged), ` +
        `Exchange: ${result.totalExchange} rows (${result.flaggedExchange} flagged)`
    );

    return result;
}
