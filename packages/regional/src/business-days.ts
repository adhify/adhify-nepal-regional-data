// @adhify/regional/business-days: business days from the bundled business-calendar release.
import { release as bundled } from './bundle/business-calendar.ts';
import { createBusinessDays, type BusinessDays } from './core/business-days.ts';
import { releaseFrom } from './core/release.ts';
import type { BusinessCalendarData } from './types.ts';

/** Business days pinned to the release bundled with this SDK version. */
export const businessDays: BusinessDays = /* @__PURE__ */ createBusinessDays(bundled);

/** Business days for a release you downloaded: its manifest.json and data/business-calendar.json. */
export function loadBusinessDays(
  manifest: Parameters<typeof releaseFrom>[0],
  data: BusinessCalendarData,
): BusinessDays {
  return createBusinessDays(releaseFrom(manifest, data, 'business-calendar'));
}

export { createBusinessDays, type BusinessDays } from './core/business-days.ts';
export * from './errors.ts';
export type { BusinessCalendarData, ReleaseInfo } from './types.ts';
