// Business days from the business-calendar release: weekly rest days, closed dates, open dates.
import { InvalidDateError, OutOfRangeError } from '../errors.ts';
import type { BusinessCalendarData, Release, ReleaseInfo } from '../types.ts';
import { fromDayNumber, toDayNumber, weekday } from './dates.ts';

export interface BusinessDays {
  release(): ReleaseInfo;
  /** AD years the release covers. */
  range(): { from: string; to: string };
  /** True when offices are open on the AD date. Throws OutOfRangeError outside the covered years. */
  isBusinessDay(date: string): boolean;
  /** The first business day after `date`. */
  next(date: string): string;
  /** The last business day before `date`. */
  previous(date: string): string;
  /** Moves `days` business days forward (or back, if negative). 0 returns `date` unchanged. */
  add(date: string, days: number): string;
  /** Business days from `from` (inclusive) to `to` (exclusive); negative if `to` is earlier. */
  between(from: string, to: string): number;
}

export function createBusinessDays(release: Release<BusinessCalendarData>): BusinessDays {
  const years = release.coverage.ad_years;
  if (!years)
    throw new OutOfRangeError('the business-calendar release has no coverage', {
      from: '',
      to: '',
    });
  const range = { from: `${years.from}-01-01`, to: `${years.to}-12-31` };
  const firstDay = toDayNumber(range.from);
  const lastDay = toDayNumber(range.to);
  const byYear = new Map(
    release.data.records.map((record) => [
      record.year,
      {
        rest: new Set(record.weekly_rest_days),
        closed: new Set(record.closed_dates.map((entry) => entry.date)),
        open: new Set(record.open_dates),
      },
    ]),
  );

  function isOpen(day: number): boolean {
    if (day < firstDay || day > lastDay) {
      throw new OutOfRangeError(`${fromDayNumber(day)} is not covered`, range);
    }
    const date = fromDayNumber(day);
    const year = byYear.get(Number(date.slice(0, 4)));
    if (!year) throw new OutOfRangeError(`${date} is not covered`, range);
    if (year.open.has(date)) return true;
    if (year.closed.has(date)) return false;
    return !year.rest.has(weekday(day));
  }

  function step(date: string, direction: 1 | -1): string {
    let day = toDayNumber(date) + direction;
    while (!isOpen(day)) day += direction;
    return fromDayNumber(day);
  }

  return {
    release: () => ({ ...release.info }),
    range: () => ({ ...range }),
    isBusinessDay: (date) => isOpen(toDayNumber(date)),
    next: (date) => step(date, 1),
    previous: (date) => step(date, -1),
    add(date, days) {
      if (!Number.isInteger(days)) throw new InvalidDateError('days must be a whole number');
      let current = date;
      toDayNumber(current);
      for (let i = 0; i < Math.abs(days); i += 1) current = step(current, days > 0 ? 1 : -1);
      return current;
    },
    between(from, to) {
      const start = toDayNumber(from);
      const end = toDayNumber(to);
      const [low, high, sign] = start <= end ? [start, end, 1] : [end, start, -1];
      let count = 0;
      for (let day = low; day < high; day += 1) if (isOpen(day)) count += 1;
      return sign * count;
    },
  };
}
