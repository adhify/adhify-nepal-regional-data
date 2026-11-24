// Administrative units: lookups by code, hierarchy and name, as of a date (units change over time).
import { UnknownUnitError } from '../errors.ts';
import type { AdminLevel, AdminUnit, AdminUnitsData, Release, ReleaseInfo } from '../types.ts';
import { toDayNumber } from './dates.ts';

export interface AsOf {
  /** AD date (YYYY-MM-DD). Defaults to the release's as-of date. */
  asOf?: string;
}

export interface AdminUnits {
  release(): ReleaseInfo;
  /** The date the release describes. */
  asOf(): string;
  /** The unit with this code on the date. Throws UnknownUnitError if there is none. */
  get(code: string, options?: AsOf): AdminUnit;
  /** Like `get`, but returns undefined instead of throwing. */
  find(code: string, options?: AsOf): AdminUnit | undefined;
  /** Every version of a unit, oldest first (renames, merges, splits). */
  history(code: string): AdminUnit[];
  /** Units one level below, sorted by English name. */
  children(code: string, options?: AsOf): AdminUnit[];
  /** Parent, grandparent … up to the province. */
  ancestors(code: string, options?: AsOf): AdminUnit[];
  /** All units on the date, optionally of one level, sorted by code. */
  list(options?: AsOf & { level?: AdminLevel }): AdminUnit[];
  /** Units whose English or Nepali name contains the query (case-insensitive). */
  search(query: string, options?: AsOf & { level?: AdminLevel; limit?: number }): AdminUnit[];
}

const copy = (unit: AdminUnit): AdminUnit => ({ ...unit, name: { ...unit.name } });

export function createAdminUnits(release: Release<AdminUnitsData>): AdminUnits {
  const defaultAsOf = release.coverage.as_of ?? '9999-12-31';
  const versions = new Map<string, AdminUnit[]>();
  for (const unit of [...release.data.records].sort((a, b) =>
    a.valid_from.localeCompare(b.valid_from),
  )) {
    versions.set(unit.code, [...(versions.get(unit.code) ?? []), unit]);
  }

  const dateOf = (options?: AsOf) => {
    const date = options?.asOf ?? defaultAsOf;
    toDayNumber(date);
    return date;
  };
  const validOn = (unit: AdminUnit, date: string) =>
    unit.valid_from <= date && (unit.valid_to === null || unit.valid_to >= date);

  function find(code: string, options?: AsOf): AdminUnit | undefined {
    const date = dateOf(options);
    const unit = versions.get(code)?.find((u) => validOn(u, date));
    return unit ? copy(unit) : undefined;
  }

  function get(code: string, options?: AsOf): AdminUnit {
    const unit = find(code, options);
    if (unit) return unit;
    throw new UnknownUnitError(
      versions.has(code)
        ? `${code} did not exist in this form on ${dateOf(options)}`
        : `${code} is not an administrative unit in this release`,
    );
  }

  function list(options?: AsOf & { level?: AdminLevel }): AdminUnit[] {
    const date = dateOf(options);
    const result: AdminUnit[] = [];
    for (const unitVersions of versions.values()) {
      const unit = unitVersions.find((u) => validOn(u, date));
      if (unit && (!options?.level || unit.level === options.level)) result.push(copy(unit));
    }
    return result.sort((a, b) => a.code.localeCompare(b.code));
  }

  return {
    release: () => ({ ...release.info }),
    asOf: () => defaultAsOf,
    get,
    find,
    history: (code) => (versions.get(code) ?? []).map(copy),
    children(code, options) {
      get(code, options);
      return list(options)
        .filter((unit) => unit.parent_code === code)
        .sort((a, b) => a.name.en.localeCompare(b.name.en));
    },
    ancestors(code, options) {
      const chain: AdminUnit[] = [];
      let unit = get(code, options);
      while (unit.parent_code !== null) {
        unit = get(unit.parent_code, options);
        chain.push(unit);
      }
      return chain;
    },
    list,
    search(query, options) {
      const needle = query.trim().toLocaleLowerCase();
      if (!needle) return [];
      return list(options)
        .filter(
          (unit) =>
            unit.name.en.toLocaleLowerCase().includes(needle) ||
            unit.name.ne.includes(query.trim()),
        )
        .slice(0, options?.limit ?? 20);
    },
  };
}
