// @adhify/regional/admin-units: administrative units from the bundled admin-units release.
import { release as bundled } from './bundle/admin-units.ts';
import { createAdminUnits, type AdminUnits } from './core/admin-units.ts';
import { releaseFrom } from './core/release.ts';
import type { AdminUnitsData } from './types.ts';

/** Administrative units pinned to the release bundled with this SDK version. */
export const adminUnits: AdminUnits = /* @__PURE__ */ createAdminUnits(bundled);

/** Units for a release you downloaded: its parsed manifest.json and data/admin-units.json. */
export function loadAdminUnits(
  manifest: Parameters<typeof releaseFrom>[0],
  data: AdminUnitsData,
): AdminUnits {
  return createAdminUnits(releaseFrom(manifest, data, 'admin-units'));
}

export { createAdminUnits, type AdminUnits, type AsOf } from './core/admin-units.ts';
export * from './errors.ts';
export type { AdminLevel, AdminUnit, AdminUnitsData, ReleaseInfo } from './types.ts';
