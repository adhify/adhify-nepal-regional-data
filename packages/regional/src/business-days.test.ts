import { describe, expect, it } from 'vitest';
import {
  InvalidDateError,
  OutOfRangeError,
  businessDays,
  loadBusinessDays,
} from './business-days.ts';
import { fromDayNumber, toDayNumber } from './core/dates.ts';
import { randomInt, seededRandom, syntheticRelease } from './testing/synthetic.ts';

// Synthetic release, AD 2900: rest day Saturday; closed 2900-01-15 and 2900-03-02;
// open on the first Saturday of March (a make-up working day).
function firstSaturdayOfMarch(): string {
  let day = toDayNumber('2900-03-01');
  while (new Date(day * 86_400_000).getUTCDay() !== 6) day += 1;
  return fromDayNumber(day);
}

describe('business days (synthetic release)', () => {
  const openSaturday = firstSaturdayOfMarch();

  it('applies weekly rest days, closed dates and open dates', () => {
    expect(businessDays.isBusinessDay('2900-01-15')).toBe(false);
    expect(businessDays.isBusinessDay('2900-03-02')).toBe(false);
    expect(businessDays.isBusinessDay(openSaturday)).toBe(true);
    const otherSaturday = fromDayNumber(toDayNumber(openSaturday) + 7);
    expect(businessDays.isBusinessDay(otherSaturday)).toBe(false);
    expect(businessDays.isBusinessDay(fromDayNumber(toDayNumber(otherSaturday) + 1))).toBe(true);
  });

  it('steps over closed days with next, previous and add', () => {
    expect(businessDays.next('2900-01-14')).not.toBe('2900-01-15');
    expect(businessDays.previous('2900-01-16')).not.toBe('2900-01-15');
    expect(businessDays.add('2900-06-10', 0)).toBe('2900-06-10');
    expect(() => businessDays.add('2900-06-10', 1.5)).toThrow(InvalidDateError);
  });

  it('property: add then between returns the same count, both directions', () => {
    const random = seededRandom(3);
    const start = toDayNumber('2900-02-01');
    for (let i = 0; i < 300; i += 1) {
      let from = fromDayNumber(randomInt(random, start, start + 250));
      if (!businessDays.isBusinessDay(from)) from = businessDays.next(from);
      const n = randomInt(random, -20, 20);
      const to = businessDays.add(from, n);
      expect(businessDays.isBusinessDay(to)).toBe(true);
      expect(businessDays.between(from, to)).toBe(n);
    }
  });

  it('throws OutOfRangeError when a step leaves the covered year', () => {
    expect(() => businessDays.isBusinessDay('2901-01-01')).toThrow(OutOfRangeError);
    expect(() => businessDays.add('2900-12-20', 30)).toThrow(OutOfRangeError);
    expect(() => businessDays.previous('2900-01-01')).toThrow(OutOfRangeError);
  });

  it('loads a downloaded release', async () => {
    const { manifest, data } = await syntheticRelease('business-calendar');
    expect(loadBusinessDays(manifest, data).isBusinessDay('2900-01-15')).toBe(false);
  });
});
