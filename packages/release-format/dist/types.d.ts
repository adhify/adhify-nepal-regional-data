export declare const DATASETS: readonly ["calendar", "holidays", "business-calendar", "admin-units", "boundaries"];
export type Dataset = (typeof DATASETS)[number];
export interface YearRange {
    from: number;
    to: number;
}
export interface Name {
    en: string;
    ne: string;
}
export interface ManifestFile {
    path: string;
    sha256: string;
    bytes: number;
    media_type: 'application/json' | 'application/geo+json';
}
export interface Source {
    id: string;
    licence: string;
    redistribution_allowed: boolean;
}
export interface Manifest {
    dataset: Dataset;
    version: string;
    schema_version: string;
    created_at: string;
    synthetic?: boolean;
    coverage: {
        bs_years?: YearRange;
        ad_years?: YearRange;
        as_of?: string;
    };
    depends_on?: string[];
    files: ManifestFile[];
    sources: Source[];
    review?: {
        reviewer: string;
        decision: 'approved' | 'rejected';
        decided_at: string;
    };
}
interface Envelope<D extends Dataset, R> {
    dataset: D;
    version: string;
    schema_version: string;
    records: R[];
}
export interface CalendarYear {
    bs_year: number;
    ad_start: string;
    month_lengths: number[];
}
export interface Holiday {
    id: string;
    date: string;
    name: Name;
    scope: {
        kind: 'national' | 'province' | 'group';
        value?: string;
    };
    status: 'announced' | 'changed' | 'cancelled';
    previous_date?: string;
    source: string;
}
export interface BusinessYear {
    year: number;
    weekly_rest_days: number[];
    closed_dates: {
        date: string;
        holiday_id?: string;
    }[];
    open_dates: string[];
}
export declare const ADMIN_LEVELS: readonly ["province", "district", "municipality", "ward"];
export type AdminLevel = (typeof ADMIN_LEVELS)[number];
export interface AdminUnit {
    code: string;
    level: AdminLevel;
    name: Name;
    parent_code: string | null;
    valid_from: string;
    valid_to: string | null;
}
export type Position = [number, number];
export type Polygon = Position[][];
export interface BoundaryFeature {
    type: 'Feature';
    properties: {
        unit_code: string;
        valid_from: string;
    };
    geometry: {
        type: 'Polygon';
        coordinates: Polygon;
    } | {
        type: 'MultiPolygon';
        coordinates: Polygon[];
    };
}
export type CalendarFile = Envelope<'calendar', CalendarYear>;
export type HolidaysFile = Envelope<'holidays', Holiday>;
export type BusinessCalendarFile = Envelope<'business-calendar', BusinessYear>;
export type AdminUnitsFile = Envelope<'admin-units', AdminUnit>;
export interface BoundariesFile {
    type: 'FeatureCollection';
    dataset: 'boundaries';
    version: string;
    schema_version: string;
    features: BoundaryFeature[];
}
export type DataFile = CalendarFile | HolidaysFile | BusinessCalendarFile | AdminUnitsFile | BoundariesFile;
/** The data files every release of a dataset must contain, and nothing else. */
export declare const EXPECTED_FILES: Record<Dataset, {
    path: string;
    media_type: ManifestFile['media_type'];
}[]>;
export interface Issue {
    /** Stable, machine-readable code, e.g. `checksum_mismatch`. */
    code: string;
    /** Where: a file path, optionally followed by a JSON pointer, e.g. `data/calendar.json#/records/3`. */
    path: string;
    message: string;
}
export interface Result {
    ok: boolean;
    issues: Issue[];
}
export {};
