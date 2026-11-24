// @adhify/regional/holidays: holiday lookups from the bundled holidays release.
import { release as bundled } from './bundle/holidays.ts';
import { createHolidays, type Holidays } from './core/holidays.ts';
import { releaseFrom } from './core/release.ts';
import type { HolidaysData } from './types.ts';

/** Holidays pinned to the release bundled with this SDK version. */
export const holidays: Holidays = /* @__PURE__ */ createHolidays(bundled);

/** Holidays for a release you downloaded: its parsed manifest.json and data/holidays.json. */
export function loadHolidays(
  manifest: Parameters<typeof releaseFrom>[0],
  data: HolidaysData,
): Holidays {
  return createHolidays(releaseFrom(manifest, data, 'holidays'));
}

export { createHolidays, type HolidayFilter, type Holidays } from './core/holidays.ts';
export * from './errors.ts';
export type { Holiday, HolidaysData, ReleaseInfo } from './types.ts';
