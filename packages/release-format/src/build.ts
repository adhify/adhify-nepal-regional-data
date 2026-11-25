// Builds a candidate release from a spreadsheet (CSV): the data file, then manifest.json with
// checksums, sizes and coverage, ready for `validateRelease` and the admin's import (R1.3).
// The data itself always comes from the person building the release and their sources.
import { sha256Hex } from './crypto.ts';
import type { CalendarYear, Manifest } from './types.ts';

/** 1.1.0 adds `provisional` calendar years; files without them are also valid 1.0.0. */
export const SCHEMA_VERSION = '1.1.0';

const encoder = new TextEncoder();
const json = (value: unknown) => encoder.encode(`${JSON.stringify(value, null, 2)}\n`);

// ---------------------------------------------------------------------------------------------
// CSV (RFC 4180: commas, double-quoted fields with "" escapes, CRLF or LF, an optional BOM)

/** Rows of cells. Blank lines are skipped; each row keeps its line number for error messages. */
export function parseCsv(text: string): { line: number; cells: string[] }[] {
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = '';
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const input = text.replace(/^\uFEFF/, '');
  const endRow = () => {
    cells.push(cell);
    if (cells.some((c) => c.trim() !== '')) rows.push({ line: rowLine, cells });
    cells = [];
    cell = '';
  };
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]!;
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        if (char === '\n') line += 1;
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      endRow();
      line += 1;
      rowLine = line;
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error(`line ${rowLine}: a quoted value is not closed`);
  endRow();
  return rows;
}

// ---------------------------------------------------------------------------------------------
// Calendar

/** Column headers of templates/calendar.csv, in order. */
export const CALENDAR_COLUMNS = [
  'bs_year',
  'ad_start',
  'baisakh',
  'jestha',
  'asar',
  'shrawan',
  'bhadra',
  'asoj',
  'kartik',
  'mangsir',
  'poush',
  'magh',
  'falgun',
  'chaitra',
  'provisional',
] as const;

/** Values of the `provisional` column: yes for years not yet in an approved almanac. */
const YES = new Set(['yes', 'y', 'true', '1']);
const NO = new Set(['', 'no', 'n', 'false', '0']);

export interface RowError {
  line: number;
  message: string;
}

/**
 * Reads calendar rows: BS year, AD date of 1 Baisakh, then the 12 month lengths. Returns the
 * records sorted by BS year with the CSV line of each, or the problems found row by row.
 */
export function calendarFromCsv(
  text: string,
): { ok: true; records: CalendarYear[]; lines: number[] } | { ok: false; errors: RowError[] } {
  const rows = parseCsv(text);
  const [header, ...body] = rows;
  const expected = CALENDAR_COLUMNS.join(',');
  // The `provisional` column is optional: sheets made from the first template have 14 columns.
  const columns = header?.cells.map((c) => c.trim().toLowerCase()).join(',');
  const width =
    columns === expected ? 15 : columns === CALENDAR_COLUMNS.slice(0, 14).join(',') ? 14 : 0;
  if (!header || width === 0) {
    return {
      ok: false,
      errors: [{ line: header?.line ?? 1, message: `the first row must be: ${expected}` }],
    };
  }
  const errors: RowError[] = [];
  const parsed: { record: CalendarYear; line: number }[] = [];
  for (const { line, cells } of body) {
    const values = cells.map((c) => c.trim());
    if (width === 15 && values.length === 14) values.push(''); // trailing empty cell dropped
    if (values.length !== width) {
      errors.push({ line, message: `has ${values.length} columns, expected ${width}` });
      continue;
    }
    const [year = '', adStart = '', ...rest] = values;
    const months = rest.slice(0, 12);
    const flag = (rest[12] ?? '').toLowerCase();
    const problems: string[] = [];
    if (!/^[0-9]{4}$/.test(year)) problems.push(`bs_year "${year}" is not a 4-digit year`);
    if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(adStart)) {
      problems.push(`ad_start "${adStart}" is not a date like 2026-04-14`);
    }
    months.forEach((value, i) => {
      if (!/^[0-9]{2}$/.test(value)) {
        problems.push(`${CALENDAR_COLUMNS[i + 2]} "${value}" is not a number of days`);
      }
    });
    if (!YES.has(flag) && !NO.has(flag)) {
      problems.push(`provisional "${rest[12]}" should be yes or empty`);
    }
    if (problems.length > 0) {
      errors.push({ line, message: problems.join('; ') });
      continue;
    }
    parsed.push({
      line,
      record: {
        bs_year: Number(year),
        ad_start: adStart,
        month_lengths: months.map(Number),
        ...(YES.has(flag) ? { provisional: true as const } : {}),
      },
    });
  }
  if (body.length === 0)
    errors.push({ line: header.line, message: 'there are no rows below the header' });
  const seen = new Map<number, number>();
  for (const { record, line } of parsed) {
    const first = seen.get(record.bs_year);
    if (first !== undefined) {
      errors.push({ line, message: `BS ${record.bs_year} is already on line ${first}` });
    } else {
      seen.set(record.bs_year, line);
    }
  }
  if (errors.length > 0) return { ok: false, errors: errors.sort((a, b) => a.line - b.line) };
  parsed.sort((a, b) => a.record.bs_year - b.record.bs_year);
  return { ok: true, records: parsed.map((p) => p.record), lines: parsed.map((p) => p.line) };
}

// ---------------------------------------------------------------------------------------------
// Release

export interface SourceDeclaration {
  id: string;
  licence: string;
  redistribution_allowed: boolean;
}

/** The calendar release: data file and manifest bytes, exactly as they will be imported. */
export async function buildCalendarRelease(options: {
  version: string;
  records: CalendarYear[];
  source: SourceDeclaration;
  createdAt: Date;
}): Promise<{ name: string; manifest: Uint8Array; files: Map<string, Uint8Array> }> {
  const data = json({
    dataset: 'calendar',
    version: options.version,
    schema_version: SCHEMA_VERSION,
    records: options.records,
  });
  const path = 'data/calendar.json';
  const manifest: Manifest = {
    dataset: 'calendar',
    version: options.version,
    schema_version: SCHEMA_VERSION,
    created_at: options.createdAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    coverage: {
      bs_years: {
        from: options.records[0]?.bs_year ?? 0,
        to: options.records.at(-1)?.bs_year ?? 0,
      },
    },
    files: [
      { path, sha256: await sha256Hex(data), bytes: data.length, media_type: 'application/json' },
    ],
    sources: [options.source],
  };
  return {
    name: `calendar@${options.version}`,
    manifest: json(manifest),
    files: new Map([[path, data]]),
  };
}

/** `data/calendar.json#/records/3/ad_start` → the CSV line of record 3, if the path has one. */
export function lineOfIssue(path: string, lines: readonly number[]): number | undefined {
  const match = /#\/records\/([0-9]+)/.exec(path);
  return match ? lines[Number(match[1])] : undefined;
}
