import type { CalendarYear } from './types.ts';
/** 1.1.0 adds `provisional` calendar years; files without them are also valid 1.0.0. */
export declare const SCHEMA_VERSION = "1.1.0";
/** Rows of cells. Blank lines are skipped; each row keeps its line number for error messages. */
export declare function parseCsv(text: string): {
    line: number;
    cells: string[];
}[];
/** Column headers of templates/calendar.csv, in order. */
export declare const CALENDAR_COLUMNS: readonly ["bs_year", "ad_start", "baisakh", "jestha", "asar", "shrawan", "bhadra", "asoj", "kartik", "mangsir", "poush", "magh", "falgun", "chaitra", "provisional"];
export interface RowError {
    line: number;
    message: string;
}
/**
 * Reads calendar rows: BS year, AD date of 1 Baisakh, then the 12 month lengths. Returns the
 * records sorted by BS year with the CSV line of each, or the problems found row by row.
 */
export declare function calendarFromCsv(text: string): {
    ok: true;
    records: CalendarYear[];
    lines: number[];
} | {
    ok: false;
    errors: RowError[];
};
export interface SourceDeclaration {
    id: string;
    licence: string;
    redistribution_allowed: boolean;
}
/** The calendar release: data file and manifest bytes, exactly as they will be imported. */
export declare function buildCalendarRelease(options: {
    version: string;
    records: CalendarYear[];
    source: SourceDeclaration;
    createdAt: Date;
}): Promise<{
    name: string;
    manifest: Uint8Array;
    files: Map<string, Uint8Array>;
}>;
/** `data/calendar.json#/records/3/ad_start` → the CSV line of record 3, if the path has one. */
export declare function lineOfIssue(path: string, lines: readonly number[]): number | undefined;
