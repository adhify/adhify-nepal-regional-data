import { describe, expect, it } from 'vitest';
import { dayNumber, daysBetween, isRealDate } from './dates.ts';

describe('dates', () => {
  it('counts days from 1970-01-01 in UTC', () => {
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1970-01-02')).toBe(1);
    expect(dayNumber('1969-12-31')).toBe(-1);
  });

  it('rejects dates that do not exist, and handles leap years', () => {
    expect(isRealDate('2024-02-29')).toBe(true);
    expect(isRealDate('2023-02-29')).toBe(false);
    expect(isRealDate('2100-02-29')).toBe(false);
    expect(isRealDate('2000-02-29')).toBe(true);
    expect(isRealDate('2026-04-31')).toBe(false);
    expect(isRealDate('20260101')).toBe(false);
  });

  it('keeps years below 100 as written', () => {
    expect(isRealDate('0050-03-01')).toBe(true);
    expect(daysBetween('0050-03-01', '0050-03-02')).toBe(1);
  });

  it('measures the days between two dates', () => {
    expect(daysBetween('2900-01-01', '2901-01-01')).toBe(365);
    expect(daysBetween('2904-01-01', '2905-01-01')).toBe(366);
  });
});
