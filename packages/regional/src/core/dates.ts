// AD dates as YYYY-MM-DD strings, handled as UTC day numbers so time zones never shift a day.
import { InvalidDateError } from '../errors.ts';

const DAY_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Day number since 1970-01-01 for a real YYYY-MM-DD date; throws InvalidDateError otherwise. */
export function toDayNumber(date: string): number {
  const match = typeof date === 'string' ? ISO.exec(date) : null;
  if (match) {
    const [year, month, day] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
    const value = new Date(0);
    value.setUTCFullYear(year, month, day);
    if (
      value.getUTCFullYear() === year &&
      value.getUTCMonth() === month &&
      value.getUTCDate() === day
    ) {
      return Math.round(value.getTime() / DAY_MS);
    }
  }
  throw new InvalidDateError(`${String(date)} is not a real date in the form YYYY-MM-DD`);
}

export function fromDayNumber(dayNumber: number): string {
  const value = new Date(dayNumber * DAY_MS);
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(dayNumber: number): number {
  return ((dayNumber % 7) + 7 + 4) % 7; // 1970-01-01 was a Thursday
}
