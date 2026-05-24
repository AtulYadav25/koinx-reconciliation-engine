
// ---------- CSV helpers ----------

/** Fields we emit for each transaction side (user_ or exchange_ prefixed). */
const TX_FIELDS = [
    'transaction_id',
    'timestamp',
    'type',
    'asset',
    'quantity',
    'price_usd',
    'fee',
    'note',
    'flagged',
    'qualityIssues',
] as const;

/** Escape a single CSV cell value (RFC 4180). */
export function csvCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    const str = Array.isArray(value) ? value.join('|') : String(value);
    // Wrap in quotes if the value contains comma, newline, or double-quote
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

/** Convert an array of row objects to a CSV string. */
export function toCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const lines: string[] = [headers.join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => csvCell(row[h])).join(','));
    }
    return lines.join('\r\n');
}

/** Flatten a nested transaction object with a column prefix. */
export function flattenTx(
    tx: Record<string, unknown> | null | undefined,
    prefix: 'user_' | 'exchange_'
): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const field of TX_FIELDS) {
        result[`${prefix}${field}`] = tx ? (tx[field] ?? '') : '';
    }
    return result;
}