import { type AdminUnitsFile, type BoundariesFile, type BusinessCalendarFile, type CalendarFile, type HolidaysFile, type Issue, type Manifest } from './types.ts';
/** BS/AD table: contiguous years, plausible year lengths, AD start dates that follow on. */
export declare function checkCalendar(file: string, data: CalendarFile, manifest: Manifest): Issue[];
/** Holidays: unique IDs, dates in coverage, changes that really move the date, known sources. */
export declare function checkHolidays(file: string, data: HolidaysFile, manifest: Manifest): Issue[];
/** Business calendar: one record per covered year, dates inside their year, no contradictions. */
export declare function checkBusinessCalendar(file: string, data: BusinessCalendarFile, manifest: Manifest): Issue[];
/** Administrative units: valid ranges, no overlapping versions, parents one level up. */
export declare function checkAdminUnits(file: string, data: AdminUnitsFile, manifest: Manifest): Issue[];
/** Boundaries: closed rings, one feature per unit version, units that exist when known. */
export declare function checkBoundaries(file: string, data: BoundariesFile, adminUnits?: AdminUnitsFile): Issue[];
