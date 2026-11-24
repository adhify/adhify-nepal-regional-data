// AD date helpers on YYYY-MM-DD strings, in UTC so time zones never shift a day.
const DAY_MS = 86_400_000;
/** Day number since 1970-01-01, or null if the string is not a real calendar date. */
export function dayNumber(date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match)
        return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    // setUTCFullYear, unlike Date.UTC, keeps years 0–99 as written.
    const value = new Date(0);
    value.setUTCFullYear(year, month, day);
    if (value.getUTCFullYear() !== year ||
        value.getUTCMonth() !== month ||
        value.getUTCDate() !== day) {
        return null;
    }
    return Math.round(value.getTime() / DAY_MS);
}
export function isRealDate(date) {
    return dayNumber(date) !== null;
}
export function yearOf(date) {
    return Number(date.slice(0, 4));
}
/** Days from `a` to `b` (positive when b is later). Both must be real dates. */
export function daysBetween(a, b) {
    return dayNumber(b) - dayNumber(a);
}
