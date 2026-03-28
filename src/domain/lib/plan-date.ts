const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a naive calendar string `YYYY-MM-DD` to a `Date` at UTC noon for Postgres `@db.Date`.
 * Rejects malformed strings and impossible calendar days (e.g. 2026-02-31).
 */
export function planDateFromYmd(ymd: string): Date {
  const m = YMD_RE.exec(ymd);
  if (!m) throw new RangeError(`Invalid plan date (expected YYYY-MM-DD): ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() + 1 !== mo || date.getUTCDate() !== d) {
    throw new RangeError(`Invalid calendar date: ${ymd}`);
  }
  return date;
}

export { formatDateAsIsoYmdUtc as planDateToYmd } from './iso-calendar-utc';
