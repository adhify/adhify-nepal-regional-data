/** Day number since 1970-01-01, or null if the string is not a real calendar date. */
export declare function dayNumber(date: string): number | null;
export declare function isRealDate(date: string): boolean;
export declare function yearOf(date: string): number;
/** Days from `a` to `b` (positive when b is later). Both must be real dates. */
export declare function daysBetween(a: string, b: string): number;
