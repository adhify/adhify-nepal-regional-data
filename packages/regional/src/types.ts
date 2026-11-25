// Data shapes the SDK reads: schema_version 1 of the release format (ADR 0002). Kept here so the
// SDK has no runtime dependency; the release-format package validates releases before bundling.

export interface ReleaseInfo {
  dataset: 'calendar' | 'holidays' | 'business-calendar' | 'admin-units';
  version: string;
  schema_version: string;
  /** True only for test fixtures. A published SDK never bundles a synthetic release. */
  synthetic: boolean;
}

export interface Name {
  en: string;
  ne: string;
}

export interface CalendarData {
  dataset: 'calendar';
  version: string;
  schema_version: string;
  records: {
    bs_year: number;
    ad_start: string;
    month_lengths: number[];
    /** Not yet in an approved almanac; may change in a later release. */
    provisional?: true;
  }[];
}

export interface Holiday {
  id: string;
  /** AD date, YYYY-MM-DD. */
  date: string;
  name: Name;
  scope: { kind: 'national' | 'province' | 'group'; value?: string };
  status: 'announced' | 'changed' | 'cancelled';
  previous_date?: string;
  source: string;
}

export interface HolidaysData {
  dataset: 'holidays';
  version: string;
  schema_version: string;
  records: Holiday[];
}

export interface BusinessCalendarData {
  dataset: 'business-calendar';
  version: string;
  schema_version: string;
  records: {
    year: number;
    weekly_rest_days: number[];
    closed_dates: { date: string; holiday_id?: string }[];
    open_dates: string[];
  }[];
}

export type AdminLevel = 'province' | 'district' | 'municipality' | 'ward';

export interface AdminUnit {
  code: string;
  level: AdminLevel;
  name: Name;
  parent_code: string | null;
  valid_from: string;
  valid_to: string | null;
}

export interface AdminUnitsData {
  dataset: 'admin-units';
  version: string;
  schema_version: string;
  records: AdminUnit[];
}

/** A dataset file plus the release facts the SDK needs (from its manifest). */
export interface Release<D> {
  info: ReleaseInfo;
  /** calendar: none; holidays and business-calendar: AD years; admin-units: as-of date. */
  coverage: { ad_years?: { from: number; to: number }; as_of?: string };
  data: D;
}
