// @adhify/regional: offline Nepal regional data. No network calls and no API key (C-12).
// Import a subpath (e.g. '@adhify/regional/calendar') to bundle only the data you use.
import { adminUnits } from './admin-units.ts';
import { businessDays } from './business-days.ts';
import { calendar } from './calendar.ts';
import { holidays } from './holidays.ts';
import type { ReleaseInfo } from './types.ts';

export { adminUnits, createAdminUnits, loadAdminUnits } from './admin-units.ts';
export type { AdminUnits, AsOf } from './admin-units.ts';
export { businessDays, createBusinessDays, loadBusinessDays } from './business-days.ts';
export type { BusinessDays } from './business-days.ts';
export { calendar, createCalendar, formatBs, loadCalendar, parseBs } from './calendar.ts';
export type { BsDate, Calendar } from './calendar.ts';
export { createHolidays, holidays, loadHolidays } from './holidays.ts';
export type { HolidayFilter, Holidays } from './holidays.ts';
export * from './errors.ts';
export type * from './types.ts';

/** The dataset releases bundled with this SDK version. */
export function releases(): ReleaseInfo[] {
  return [calendar, holidays, businessDays, adminUnits].map((module) => module.release());
}
