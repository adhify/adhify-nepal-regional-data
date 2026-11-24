// Holiday lookups. Records keep their source status; nothing here is presented as official.
import { OutOfRangeError } from '../errors.ts';
import type { Holiday, HolidaysData, Release, ReleaseInfo } from '../types.ts';
import { toDayNumber } from './dates.ts';

export interface HolidayFilter {
  /**
   * Which holidays apply. Omit to get every scope. When given, national holidays always apply,
   * plus those for the province code and group labels listed.
   */
  scope?: { province?: string; groups?: readonly string[] };
  /** Include cancelled holidays (default false). */
  includeCancelled?: boolean;
}

export interface Holidays {
  release(): ReleaseInfo;
  /** AD years the release covers. */
  range(): { from: string; to: string };
  /** Holidays on an AD date. Throws OutOfRangeError outside the covered years. */
  on(date: string, filter?: HolidayFilter): Holiday[];
  /** Holidays from `from` to `to`, both inclusive, in date order. */
  between(from: string, to: string, filter?: HolidayFilter): Holiday[];
  /** True when at least one holiday matching the filter falls on the date. */
  isHoliday(date: string, filter?: HolidayFilter): boolean;
  /** A holiday by its ID, or undefined. */
  get(id: string): Holiday | undefined;
}

function applies(holiday: Holiday, filter: HolidayFilter = {}): boolean {
  if (holiday.status === 'cancelled' && !filter.includeCancelled) return false;
  const scope = filter.scope;
  if (!scope || holiday.scope.kind === 'national') return true;
  if (holiday.scope.kind === 'province') return holiday.scope.value === scope.province;
  return scope.groups?.includes(holiday.scope.value ?? '') ?? false;
}

const copy = (holiday: Holiday): Holiday => ({
  ...holiday,
  name: { ...holiday.name },
  scope: { ...holiday.scope },
});

export function createHolidays(release: Release<HolidaysData>): Holidays {
  const years = release.coverage.ad_years;
  if (!years)
    throw new OutOfRangeError('the holidays release has no coverage', { from: '', to: '' });
  const range = { from: `${years.from}-01-01`, to: `${years.to}-12-31` };
  const sorted = [...release.data.records].sort((a, b) => a.date.localeCompare(b.date));
  const byId = new Map(sorted.map((holiday) => [holiday.id, holiday]));

  function covered(date: string): number {
    const day = toDayNumber(date);
    if (date < range.from || date > range.to)
      throw new OutOfRangeError(`${date} is not covered`, range);
    return day;
  }

  const between = (from: string, to: string, filter?: HolidayFilter) => {
    covered(from);
    covered(to);
    return sorted.filter((h) => h.date >= from && h.date <= to && applies(h, filter)).map(copy);
  };

  return {
    release: () => ({ ...release.info }),
    range: () => ({ ...range }),
    on: (date, filter) => between(date, date, filter),
    between,
    isHoliday: (date, filter) => between(date, date, filter).length > 0,
    get: (id) => {
      const holiday = byId.get(id);
      return holiday ? copy(holiday) : undefined;
    },
  };
}
