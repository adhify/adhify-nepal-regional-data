// Semantic checks that JSON Schema cannot express (ADR 0002). Each runs on a file that already
// passed its schema, and returns issues with stable codes.
import { dayNumber, daysBetween, isRealDate, yearOf } from './dates.ts';
import {
  ADMIN_LEVELS,
  type AdminUnit,
  type AdminUnitsFile,
  type BoundariesFile,
  type BusinessCalendarFile,
  type CalendarFile,
  type HolidaysFile,
  type Issue,
  type Manifest,
  type Polygon,
} from './types.ts';

type Push = (code: string, pointer: string, message: string) => void;

function collector(file: string): { issues: Issue[]; push: Push } {
  const issues: Issue[] = [];
  return {
    issues,
    push: (code, pointer, message) => issues.push({ code, path: `${file}#${pointer}`, message }),
  };
}

function realDate(push: Push, pointer: string, date: string | null | undefined): boolean {
  if (date == null) return true;
  if (isRealDate(date)) return true;
  push('invalid_date', pointer, `${date} is not a real calendar date`);
  return false;
}

/** BS/AD table: contiguous years, plausible year lengths, AD start dates that follow on. */
export function checkCalendar(file: string, data: CalendarFile, manifest: Manifest): Issue[] {
  const { issues, push } = collector(file);
  data.records.forEach((year, i) => {
    realDate(push, `/records/${i}/ad_start`, year.ad_start);
    const length = year.month_lengths.reduce((sum, days) => sum + days, 0);
    if (length < 365 || length > 366) {
      push('calendar_year_length', `/records/${i}`, `BS ${year.bs_year} has ${length} days`);
    }
    const previous = data.records[i - 1];
    if (!previous) return;
    if (year.bs_year !== previous.bs_year + 1) {
      push(
        'calendar_gap',
        `/records/${i}/bs_year`,
        `BS ${year.bs_year} follows BS ${previous.bs_year}; years must be consecutive`,
      );
      return;
    }
    const previousLength = previous.month_lengths.reduce((sum, days) => sum + days, 0);
    if (
      isRealDate(previous.ad_start) &&
      isRealDate(year.ad_start) &&
      daysBetween(previous.ad_start, year.ad_start) !== previousLength
    ) {
      push(
        'calendar_discontinuity',
        `/records/${i}/ad_start`,
        `BS ${year.bs_year} starts ${daysBetween(previous.ad_start, year.ad_start)} days after BS ${previous.bs_year}, which has ${previousLength}`,
      );
    }
  });
  const first = data.records[0]?.bs_year;
  const last = data.records.at(-1)?.bs_year;
  const range = manifest.coverage.bs_years;
  if (range && (range.from !== first || range.to !== last)) {
    push(
      'coverage_mismatch',
      '/records',
      `manifest covers BS ${range.from}–${range.to}, file has ${first}–${last}`,
    );
  }
  return issues;
}

/** Holidays: unique IDs, dates in coverage, changes that really move the date, known sources. */
export function checkHolidays(file: string, data: HolidaysFile, manifest: Manifest): Issue[] {
  const { issues, push } = collector(file);
  const ids = new Set<string>();
  const sources = new Set(manifest.sources.map((s) => s.id));
  const range = manifest.coverage.ad_years;
  data.records.forEach((holiday, i) => {
    const at = `/records/${i}`;
    if (ids.has(holiday.id)) push('duplicate_id', `${at}/id`, `${holiday.id} appears twice`);
    ids.add(holiday.id);
    if (realDate(push, `${at}/date`, holiday.date) && range) {
      const year = yearOf(holiday.date);
      if (year < range.from || year > range.to) {
        push(
          'out_of_coverage',
          `${at}/date`,
          `${holiday.date} is outside ${range.from}–${range.to}`,
        );
      }
    }
    realDate(push, `${at}/previous_date`, holiday.previous_date);
    if (holiday.previous_date === holiday.date) {
      push('invalid_change', `${at}/previous_date`, 'a changed holiday must move to a new date');
    }
    if (!sources.has(holiday.source)) {
      push('unknown_source', `${at}/source`, `${holiday.source} is not listed in the manifest`);
    }
  });
  return issues;
}

/** Business calendar: one record per covered year, dates inside their year, no contradictions. */
export function checkBusinessCalendar(
  file: string,
  data: BusinessCalendarFile,
  manifest: Manifest,
): Issue[] {
  const { issues, push } = collector(file);
  const years = new Set<number>();
  const range = manifest.coverage.ad_years;
  data.records.forEach((record, i) => {
    const at = `/records/${i}`;
    if (years.has(record.year))
      push('duplicate_year', `${at}/year`, `${record.year} appears twice`);
    years.add(record.year);
    if (range && (record.year < range.from || record.year > range.to)) {
      push('out_of_coverage', `${at}/year`, `${record.year} is outside ${range.from}–${range.to}`);
    }
    const closed = new Set<string>();
    record.closed_dates.forEach((entry, j) => {
      const pointer = `${at}/closed_dates/${j}/date`;
      if (!realDate(push, pointer, entry.date)) return;
      if (yearOf(entry.date) !== record.year) {
        push('date_outside_year', pointer, `${entry.date} is not in ${record.year}`);
      }
      if (closed.has(entry.date)) push('duplicate_date', pointer, `${entry.date} appears twice`);
      closed.add(entry.date);
    });
    const open = new Set<string>();
    record.open_dates.forEach((date, j) => {
      const pointer = `${at}/open_dates/${j}`;
      if (!realDate(push, pointer, date)) return;
      if (yearOf(date) !== record.year) {
        push('date_outside_year', pointer, `${date} is not in ${record.year}`);
      }
      if (open.has(date)) push('duplicate_date', pointer, `${date} appears twice`);
      open.add(date);
      if (closed.has(date)) push('conflicting_date', pointer, `${date} is both closed and open`);
      const weekday = (((dayNumber(date) as number) % 7) + 11) % 7; // 1970-01-01 was a Thursday (4)
      if (!record.weekly_rest_days.includes(weekday)) {
        push('open_date_not_rest_day', pointer, `${date} is not a weekly rest day`);
      }
    });
  });
  if (range) {
    for (let year = range.from; year <= range.to; year += 1) {
      if (!years.has(year)) push('coverage_mismatch', '/records', `no record for ${year}`);
    }
  }
  return issues;
}

function overlaps(a: AdminUnit, b: AdminUnit): boolean {
  const aEnd = a.valid_to ?? '9999-12-31';
  const bEnd = b.valid_to ?? '9999-12-31';
  return a.valid_from <= bEnd && b.valid_from <= aEnd;
}

/** Administrative units: valid ranges, no overlapping versions, parents one level up. */
export function checkAdminUnits(file: string, data: AdminUnitsFile, manifest: Manifest): Issue[] {
  const { issues, push } = collector(file);
  const byCode = new Map<string, AdminUnit[]>();
  data.records.forEach((unit) => byCode.set(unit.code, [...(byCode.get(unit.code) ?? []), unit]));
  const asOf = manifest.coverage.as_of;

  data.records.forEach((unit, i) => {
    const at = `/records/${i}`;
    const fromOk = realDate(push, `${at}/valid_from`, unit.valid_from);
    const toOk = realDate(push, `${at}/valid_to`, unit.valid_to);
    if (fromOk && toOk && unit.valid_to !== null && unit.valid_to < unit.valid_from) {
      push('invalid_range', `${at}/valid_to`, `${unit.code} ends before it starts`);
    }
    if (asOf && unit.valid_from > asOf) {
      push(
        'out_of_coverage',
        `${at}/valid_from`,
        `${unit.code} starts after the release date ${asOf}`,
      );
    }
    const versions = byCode.get(unit.code) ?? [];
    for (const other of versions) {
      if (other === unit) continue;
      if (other.valid_from === unit.valid_from) {
        push('duplicate_unit', at, `${unit.code} from ${unit.valid_from} appears twice`);
      } else if (overlaps(unit, other) && unit.valid_from < other.valid_from) {
        push('overlapping_validity', at, `${unit.code} has overlapping versions`);
      }
    }

    const level = ADMIN_LEVELS.indexOf(unit.level);
    if (level === 0) {
      if (unit.parent_code !== null) {
        push('invalid_parent', `${at}/parent_code`, `province ${unit.code} cannot have a parent`);
      }
      return;
    }
    if (unit.parent_code === null) {
      push('invalid_parent', `${at}/parent_code`, `${unit.level} ${unit.code} needs a parent`);
      return;
    }
    const parents = byCode.get(unit.parent_code) ?? [];
    if (parents.length === 0) {
      push('unknown_parent', `${at}/parent_code`, `${unit.parent_code} does not exist`);
      return;
    }
    const expected = ADMIN_LEVELS[level - 1];
    if (!parents.some((parent) => parent.level === expected && overlaps(parent, unit))) {
      push(
        'invalid_parent',
        `${at}/parent_code`,
        `${unit.parent_code} is not a ${expected} valid during ${unit.code}'s validity`,
      );
    }
  });
  return issues;
}

function polygonsOf(feature: BoundariesFile['features'][number]): Polygon[] {
  return feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;
}

/** Boundaries: closed rings, one feature per unit version, units that exist when known. */
export function checkBoundaries(
  file: string,
  data: BoundariesFile,
  adminUnits?: AdminUnitsFile,
): Issue[] {
  const { issues, push } = collector(file);
  const seen = new Set<string>();
  const units = adminUnits
    ? new Set(adminUnits.records.map((u) => `${u.code}@${u.valid_from}`))
    : undefined;
  data.features.forEach((feature, i) => {
    const at = `/features/${i}`;
    const key = `${feature.properties.unit_code}@${feature.properties.valid_from}`;
    realDate(push, `${at}/properties/valid_from`, feature.properties.valid_from);
    if (seen.has(key)) push('duplicate_unit', at, `${key} appears twice`);
    seen.add(key);
    if (units && !units.has(key)) {
      push('unknown_unit', `${at}/properties`, `${key} is not in the admin-units release`);
    }
    polygonsOf(feature).forEach((polygon, p) =>
      polygon.forEach((ring, r) => {
        const first = ring[0];
        const last = ring.at(-1);
        if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
          push('ring_not_closed', `${at}/geometry`, `polygon ${p}, ring ${r} is not closed`);
        }
      }),
    );
  });
  return issues;
}
