/**
 * Format a `Date` as ISO calendar `YYYY-MM-DD` using **UTC** components.
 * Use for values aligned with `Date.UTC` noon / Postgres `@db.Date` readbacks
 * (same assumptions as {@link planDateFromYmd} in `./plan-date.ts`).
 */
export function formatDateAsIsoYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
