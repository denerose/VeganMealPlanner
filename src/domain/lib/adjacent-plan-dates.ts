import { addDays, subDays } from 'date-fns';
import { planDateFromYmd } from './plan-date';

/** ISO calendar `YYYY-MM-DD` using UTC date components (stable for `DayPlan` / `planDateFromYmd`). */
function formatPlanYmdUtc(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Previous calendar day for a naive `YYYY-MM-DD`, consistent with {@link planDateFromYmd} storage.
 */
export function previousPlanYmd(ymd: string): string {
  const ref = planDateFromYmd(ymd);
  return formatPlanYmdUtc(subDays(ref, 1));
}

/**
 * Next calendar day for a naive `YYYY-MM-DD`, consistent with {@link planDateFromYmd} storage.
 */
export function nextPlanYmd(ymd: string): string {
  const ref = planDateFromYmd(ymd);
  return formatPlanYmdUtc(addDays(ref, 1));
}
