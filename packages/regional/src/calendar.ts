// @adhify/regional/calendar: BS ↔ AD conversion from the bundled calendar release.
import { release as bundled } from './bundle/calendar.ts';
import { createCalendar, type Calendar } from './core/calendar.ts';
import { releaseFrom } from './core/release.ts';
import type { CalendarData } from './types.ts';

/** Calendar pinned to the release bundled with this SDK version. */
export const calendar: Calendar = /* @__PURE__ */ createCalendar(bundled);

/** Calendar for a release you downloaded: its parsed manifest.json and data/calendar.json. */
export function loadCalendar(
  manifest: Parameters<typeof releaseFrom>[0],
  data: CalendarData,
): Calendar {
  return createCalendar(releaseFrom(manifest, data, 'calendar'));
}

export { createCalendar, formatBs, parseBs, type BsDate, type Calendar } from './core/calendar.ts';
export * from './errors.ts';
export type { CalendarData, ReleaseInfo } from './types.ts';
