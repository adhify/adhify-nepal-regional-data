import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  CALENDAR_COLUMNS,
  buildCalendarRelease,
  calendarFromCsv,
  lineOfIssue,
  parseCsv,
} from './build.ts';
import { validateRelease } from './release.ts';
import type { CalendarFile } from './types.ts';

// Synthetic rows only (C-08): the synthetic fixture's far-future years, turned into CSV.
const fixture = JSON.parse(
  await readFile(
    new URL('../fixtures/synthetic/calendar@2026.1/data/calendar.json', import.meta.url),
    'utf8',
  ),
) as CalendarFile;
const HEADER = CALENDAR_COLUMNS.join(',');
const row = (r: CalendarFile['records'][number]) =>
  [r.bs_year, r.ad_start, ...r.month_lengths].join(',');
const SYNTHETIC_CSV = [HEADER, ...fixture.records.map(row)].join('\n');
const SOURCE = {
  id: 'src-synthetic',
  licence: 'Synthetic test data',
  redistribution_allowed: true,
};

describe('CSV', () => {
  it('reads quotes, escaped quotes, CRLF, a BOM, and skips blank lines', () => {
    const rows = parseCsv('\uFEFFa,"b, c","say ""hi"""\r\n\r\n1,2,3\n');
    expect(rows).toEqual([
      { line: 1, cells: ['a', 'b, c', 'say "hi"'] },
      { line: 3, cells: ['1', '2', '3'] },
    ]);
  });

  it('refuses an unclosed quote', () => {
    expect(() => parseCsv('a,"b\n1,2')).toThrow('not closed');
  });
});

describe('calendar from CSV', () => {
  it('reads the template header and synthetic rows, sorted by BS year', () => {
    const shuffled = [HEADER, ...fixture.records.map(row).reverse()].join('\n');
    const read = calendarFromCsv(shuffled);
    expect(read.ok && read.records).toEqual(fixture.records);
    expect(read.ok && read.lines).toEqual([4, 3, 2]);
  });

  it('matches the shipped template header', async () => {
    const template = await readFile(new URL('../templates/calendar.csv', import.meta.url), 'utf8');
    expect(template.trim()).toBe(HEADER);
  });

  it('reports problems by line, and duplicates', () => {
    const bad = [
      HEADER,
      '2901,2844-4-13,31,32,31,32,31,30,30,29,30,29,30,30',
      '2902,2845-04-13,31,31,32,32,31,30,30,29,30,29,30',
      row(fixture.records[0]!),
      row(fixture.records[0]!),
    ].join('\n');
    const read = calendarFromCsv(bad);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.errors).toEqual([
      { line: 2, message: 'ad_start "2844-4-13" is not a date like 2026-04-14' },
      { line: 3, message: 'has 13 columns, expected 15' },
      { line: 5, message: 'BS 2901 is already on line 4' },
    ]);
  });

  it('refuses a wrong header or an empty sheet', () => {
    expect(calendarFromCsv('year,start\n2901,2844-04-13').ok).toBe(false);
    expect(calendarFromCsv(HEADER)).toEqual({
      ok: false,
      errors: [{ line: 1, message: 'there are no rows below the header' }],
    });
  });
});

describe('provisional years', () => {
  const withFlags = (flags: string[]) =>
    [HEADER, ...fixture.records.map((r, i) => `${row(r)},${flags[i] ?? ''}`)].join('\n');

  it('marks rows with yes as provisional and leaves the rest approved', () => {
    const read = calendarFromCsv(withFlags(['', 'no', 'yes']));
    expect(read.ok && read.records.map((r) => r.provisional)).toEqual([undefined, undefined, true]);
  });

  it('refuses other values', () => {
    const read = calendarFromCsv(withFlags(['', '', 'maybe']));
    expect(!read.ok && read.errors).toEqual([
      { line: 4, message: 'provisional "maybe" should be yes or empty' },
    ]);
  });

  it('still reads sheets made from the first, 14-column template', () => {
    const legacy = [CALENDAR_COLUMNS.slice(0, 14).join(','), ...fixture.records.map(row)].join(
      '\n',
    );
    expect(calendarFromCsv(legacy)).toMatchObject({ ok: true, records: fixture.records });
  });

  it('builds a valid 1.1.0 release, and refuses approved years after provisional ones', async () => {
    const build = async (flags: string[]) => {
      const read = calendarFromCsv(withFlags(flags));
      if (!read.ok) throw new Error('unexpected');
      const release = await buildCalendarRelease({
        version: '2026.7',
        records: read.records,
        source: SOURCE,
        createdAt: new Date(),
      });
      return validateRelease({ manifest: release.manifest, files: release.files });
    };
    const good = await build(['', 'yes', 'yes']);
    expect(good).toMatchObject({ ok: true, manifest: { schema_version: '1.1.0' } });
    const bad = await build(['yes', '', '']);
    expect(bad.issues.map((i) => i.code)).toEqual(['calendar_provisional_order']);
  });
});

describe('calendar release', () => {
  it('builds a release the validator accepts, with coverage, checksum and size', async () => {
    const read = calendarFromCsv(SYNTHETIC_CSV);
    if (!read.ok) throw new Error('fixture CSV invalid');
    const release = await buildCalendarRelease({
      version: '2026.7',
      records: read.records,
      source: SOURCE,
      createdAt: new Date('2026-11-25T06:00:00.123Z'),
    });
    expect(release.name).toBe('calendar@2026.7');
    const result = await validateRelease({ manifest: release.manifest, files: release.files });
    expect(result).toMatchObject({ ok: true, issues: [] });
    expect(result.manifest).toMatchObject({
      created_at: '2026-11-25T06:00:00Z',
      coverage: { bs_years: { from: 2901, to: 2903 } },
      sources: [SOURCE],
    });
    expect(result.manifest?.review).toBeUndefined();
    expect(result.manifest?.synthetic).toBeUndefined();
  });

  it('maps validator findings back to CSV lines', async () => {
    const records = structuredClone(fixture.records);
    records[1]!.ad_start = '2845-04-20'; // no longer follows on from the year before
    const csv = [HEADER, ...records.map(row)].join('\n');
    const read = calendarFromCsv(csv);
    if (!read.ok) throw new Error('unexpected');
    const release = await buildCalendarRelease({
      version: '2026.7',
      records: read.records,
      source: SOURCE,
      createdAt: new Date(),
    });
    const result = await validateRelease({ manifest: release.manifest, files: release.files });
    const issue = result.issues.find((i) => i.code === 'calendar_discontinuity');
    expect(issue && lineOfIssue(issue.path, read.lines)).toBe(3);
  });
});
