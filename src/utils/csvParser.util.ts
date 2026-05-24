import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

/**
 * Parsed CSV row as raw key-value strings.
 * All values are kept as strings for downstream validation.
 */
export type RawCsvRow = Record<string, string>;

/**
 * Parse a CSV file and return an array of raw row objects.
 * Handles BOM, trims whitespace, skips completely empty lines.
 */
export function parseCsvFile(filePath: string): RawCsvRow[] {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`CSV file not found: ${absolutePath}`);
    }

    const fileContent = fs.readFileSync(absolutePath, 'utf-8');

    const records: RawCsvRow[] = parse(fileContent, {
        columns: true,          // Use first row as header
        skip_empty_lines: true,
        trim: true,
        bom: true,              // Handle UTF-8 BOM
        relax_column_count: true,
    });

    return records;
}
