import { describe, expect, it } from 'vitest';
import {
  InvalidDateError,
  OutOfRangeError,
  UnsupportedReleaseError,
  calendar,
  formatBs,
  loadCalendar,
  parseBs,
  type BsDate,
} from './calendar.ts';
import { fromDayNumber, toDayNumber } from './core/dates.ts';
import { randomInt, seededRandom, syntheticRelease } from './testing/synthetic.ts';

// Synthetic release: BS 2901–2903, starting 2844-04-13 (365, 366 and 365 days).
const RUNS = 2000;

function nextBs(bs: BsDate): BsDate {
  if (bs.day < calendar.daysInMonth(bs.year, bs.month)) return { ...bs, day: bs.day + 1 };
  if (bs.month < 12) return { year: bs.year, month: bs.month + 1, day: 1 };
  return { year: bs.year + 1, month: 1, day: 1 };
}

describe('calendar (synthetic release)', () => {
  const { ad, bs } = calendar.range();
  const first = toDayNumber(ad.from);
  const last = toDayNumber(ad.to);

  it('reports the bundled release and its range', () => {
    expect(calendar.release()).toEqual({
      dataset: 'calendar',
      version: '2026.1',
      schema_version: '1.0.0',
      synthetic: true,
    });
    expect(ad).toEqual({ from: '2844-04-13', to: fromDayNumber(first + 365 + 366 + 365 - 1) });
    expect(bs.from).toEqual({ year: 2901, month: 1, day: 1 });
    expect(bs.to).toEqual({ year: 2903, month: 12, day: 30 });
  });

  it('property: AD → BS → AD returns the same date', () => {
    const random = seededRandom(1);
    for (let i = 0; i < RUNS; i += 1) {
      const date = fromDayNumber(randomInt(random, first, last));
      expect(calendar.toAd(calendar.toBs(date))).toBe(date);
    }
  });

  it('property: BS → AD → BS returns the same date', () => {
    const random = seededRandom(2);
    for (let i = 0; i < RUNS; i += 1) {
      const year = randomInt(random, 2901, 2903);
      const month = randomInt(random, 1, 12);
      const day = randomInt(random, 1, calendar.daysInMonth(year, month));
      expect(calendar.toBs(calendar.toAd({ year, month, day }))).toEqual({ year, month, day });
    }
  });

  it('property: consecutive AD days are consecutive BS days, across every month and year', () => {
    let previous = calendar.toBs(ad.from);
    for (let day = first + 1; day <= last; day += 1) {
      const current = calendar.toBs(fromDayNumber(day));
      expect(current).toEqual(nextBs(previous));
      previous = current;
    }
  });

  it('maps each 1 Baisakh to the AD start date in the release', async () => {
    const { data } = await syntheticRelease('calendar');
    for (const record of data.records) {
      expect(calendar.toAd({ year: record.bs_year, month: 1, day: 1 })).toBe(record.ad_start);
    }
  });

  it('throws OutOfRangeError just outside the release, with the covered range', () => {
    const before = fromDayNumber(first - 1);
    expect(() => calendar.toBs(before)).toThrow(OutOfRangeError);
    try {
      calendar.toBs(fromDayNumber(last + 1));
    } catch (error) {
      expect((error as OutOfRangeError).code).toBe('out_of_range');
      expect((error as OutOfRangeError).range).toEqual(ad);
    }
    expect(() => calendar.toAd({ year: 2904, month: 1, day: 1 })).toThrow(OutOfRangeError);
    expect(() => calendar.daysInMonth(2900, 1)).toThrow(OutOfRangeError);
  });

  it.each(['2900-02-30', '2844/04/13', '', '2844-4-13'])(
    'throws InvalidDateError for the AD input %j',
    (value) => {
      expect(() => calendar.toBs(value)).toThrow(InvalidDateError);
    },
  );

  it.each([
    { year: 2901, month: 13, day: 1 },
    { year: 2901, month: 0, day: 1 },
    { year: 2901, month: 1, day: 32 },
    { year: 2901, month: 1, day: 0 },
    { year: 2901.5, month: 1, day: 1 },
  ])('rejects the BS date %j', (value) => {
    expect(() => calendar.toAd(value)).toThrow(InvalidDateError);
    expect(calendar.isValidBs(value)).toBe(false);
  });

  it('formats and parses BS dates', () => {
    expect(formatBs({ year: 2901, month: 1, day: 5 })).toBe('2901-01-05');
    expect(parseBs('2901-12-30')).toEqual({ year: 2901, month: 12, day: 30 });
    expect(() => parseBs('2901-1-5')).toThrow(InvalidDateError);
  });

  it('says which years are provisional (schema 1.1.0)', async () => {
    const { manifest, data } = await syntheticRelease('calendar');
    expect(calendar.isProvisional(2903)).toBe(false);
    const marked = structuredClone(data);
    marked.schema_version = '1.1.0';
    marked.records[2]!.provisional = true;
    const loaded = loadCalendar({ ...manifest, schema_version: '1.1.0' }, marked);
    expect([2901, 2902, 2903].map((year) => loaded.isProvisional(year))).toEqual([
      false,
      false,
      true,
    ]);
    // Provisional years convert like any other.
    expect(loaded.toAd({ year: 2903, month: 1, day: 1 })).toBe(
      calendar.toAd({ year: 2903, month: 1, day: 1 }),
    );
    expect(() => loaded.isProvisional(2904)).toThrow(OutOfRangeError);
  });

  it('loads a downloaded release and refuses mismatched or unsupported ones', async () => {
    const { manifest, data } = await syntheticRelease('calendar');
    expect(loadCalendar(manifest, data).toBs('2844-04-13')).toEqual({
      year: 2901,
      month: 1,
      day: 1,
    });
    expect(() => loadCalendar({ ...manifest, dataset: 'holidays' }, data)).toThrow(
      UnsupportedReleaseError,
    );
    expect(() => loadCalendar({ ...manifest, version: '2026.2' }, data)).toThrow(
      UnsupportedReleaseError,
    );
    expect(() =>
      loadCalendar({ ...manifest, schema_version: '2.0.0' }, { ...data, schema_version: '2.0.0' }),
    ).toThrow(/not supported/);
  });
});
