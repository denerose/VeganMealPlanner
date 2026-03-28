/**
 * Parses a naive calendar string `YYYY-MM-DD` to a `Date` at UTC noon for Postgres `@db.Date`.
 * Does not validate that the day exists in the month; invalid combinations are normalized by
 * `Date.UTC` (e.g. 2026-02-31 rolls). Prefer validating at the API layer if strict calendar
 * semantics are required.
 */
export function planDateFromYmd(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) throw new RangeError(`Invalid plan date (expected YYYY-MM-DD): ${ymd}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0));
}
