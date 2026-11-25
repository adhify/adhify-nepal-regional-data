// BS ↔ AD conversion from a release's month-length table. No formulas: every day comes from data.
import { InvalidDateError, OutOfRangeError } from '../errors.ts';
import type { CalendarData, Release, ReleaseInfo } from '../types.ts';
import { fromDayNumber, toDayNumber } from './dates.ts';

/** A Bikram Sambat date. Months are 1 (Baisakh) to 12 (Chaitra). */
export interface BsDate {
  year: number;
  month: number;
  day: number;
}

export interface Calendar {
  /** The dataset release this calendar uses. */
  release(): ReleaseInfo;
  /** First and last day covered, in both calendars. */
  range(): { bs: { from: BsDate; to: BsDate }; ad: { from: string; to: string } };
  /** AD date (YYYY-MM-DD) to BS. Throws InvalidDateError or OutOfRangeError. */
  toBs(ad: string): BsDate;
  /** BS date to AD (YYYY-MM-DD). Throws InvalidDateError or OutOfRangeError. */
  toAd(bs: BsDate): string;
  /** Days in a BS month. Throws OutOfRangeError for years the release does not cover. */
  daysInMonth(year: number, month: number): number;
  /** True when the BS date exists in the covered range. */
  isValidBs(bs: BsDate): boolean;
  /**
   * True when the release marks this BS year provisional: not yet in an approved almanac, so its
   * dates may change in a later release. Throws OutOfRangeError for years the release does not cover.
   */
  isProvisional(year: number): boolean;
}

/** Formats a BS date as YYYY-MM-DD. */
export function formatBs(bs: BsDate): string {
  return `${String(bs.year).padStart(4, '0')}-${String(bs.month).padStart(2, '0')}-${String(bs.day).padStart(2, '0')}`;
}

/** Parses YYYY-MM-DD into a BS date (shape only; use `isValidBs` to check it exists). */
export function parseBs(value: string): BsDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new InvalidDateError(`${value} is not a BS date in the form YYYY-MM-DD`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

interface Year {
  bsYear: number;
  start: number; // AD day number of 1 Baisakh
  monthStarts: number[]; // offset of each month's first day from `start`
  lengths: number[];
  length: number;
  provisional: boolean;
}

export function createCalendar(release: Release<CalendarData>): Calendar {
  const years: Year[] = release.data.records.map((record) => {
    const monthStarts: number[] = [];
    let offset = 0;
    for (const days of record.month_lengths) {
      monthStarts.push(offset);
      offset += days;
    }
    return {
      bsYear: record.bs_year,
      start: toDayNumber(record.ad_start),
      monthStarts,
      lengths: record.month_lengths,
      length: offset,
      provisional: record.provisional === true,
    };
  });
  const first = years[0];
  const last = years.at(-1);
  if (!first || !last)
    throw new OutOfRangeError('the calendar release is empty', { from: '', to: '' });
  const firstDay = first.start;
  const lastDay = last.start + last.length - 1;
  const adRange = { from: fromDayNumber(firstDay), to: fromDayNumber(lastDay) };
  const lastMonth = last.lengths.length;
  const bsRange = {
    from: { year: first.bsYear, month: 1, day: 1 },
    to: { year: last.bsYear, month: lastMonth, day: last.lengths[lastMonth - 1] as number },
  };
  const bsRangeText = { from: formatBs(bsRange.from), to: formatBs(bsRange.to) };

  function yearOf(bsYear: number): Year {
    const year = years[bsYear - first!.bsYear];
    if (!year || year.bsYear !== bsYear) {
      throw new OutOfRangeError(`BS ${bsYear} is not covered`, bsRangeText);
    }
    return year;
  }

  function checkBs(bs: BsDate): Year {
    if (![bs?.year, bs?.month, bs?.day].every(Number.isInteger)) {
      throw new InvalidDateError('a BS date needs whole-number year, month and day');
    }
    const year = yearOf(bs.year);
    const days = year.lengths[bs.month - 1];
    if (days === undefined || bs.day < 1 || bs.day > days) {
      throw new InvalidDateError(`${formatBs(bs)} does not exist`);
    }
    return year;
  }

  return {
    release: () => ({ ...release.info }),
    range: () => ({ bs: { from: { ...bsRange.from }, to: { ...bsRange.to } }, ad: { ...adRange } }),

    toBs(ad) {
      const day = toDayNumber(ad);
      if (day < firstDay || day > lastDay)
        throw new OutOfRangeError(`${ad} is not covered`, adRange);
      // Binary search for the year whose first day is the last one at or before `day`.
      let low = 0;
      let high = years.length - 1;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if ((years[mid] as Year).start <= day) low = mid;
        else high = mid - 1;
      }
      const year = years[low] as Year;
      const offset = day - year.start;
      let month = year.monthStarts.length - 1;
      while ((year.monthStarts[month] as number) > offset) month -= 1;
      return {
        year: year.bsYear,
        month: month + 1,
        day: offset - (year.monthStarts[month] as number) + 1,
      };
    },

    toAd(bs) {
      const year = checkBs(bs);
      return fromDayNumber(year.start + (year.monthStarts[bs.month - 1] as number) + bs.day - 1);
    },

    daysInMonth(bsYear, month) {
      const days = yearOf(bsYear).lengths[month - 1];
      if (days === undefined) throw new InvalidDateError(`month ${month} does not exist`);
      return days;
    },

    isProvisional(bsYear) {
      return yearOf(bsYear).provisional;
    },

    isValidBs(bs) {
      try {
        checkBs(bs);
        return true;
      } catch {
        return false;
      }
    },
  };
}
