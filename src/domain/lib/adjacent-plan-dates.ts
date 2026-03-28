import { addDays, subDays } from 'date-fns';
import { formatDateAsIsoYmdUtc } from './iso-calendar-utc';
import { planDateFromYmd } from './plan-date';

/**
 * Previous calendar day for a naive `YYYY-MM-DD`, consistent with {@link planDateFromYmd} storage.
 */
export function previousPlanYmd(ymd: string): string {
  const ref = planDateFromYmd(ymd);
  return formatDateAsIsoYmdUtc(subDays(ref, 1));
}

/**
 * Next calendar day for a naive `YYYY-MM-DD`, consistent with {@link planDateFromYmd} storage.
 */
export function nextPlanYmd(ymd: string): string {
  const ref = planDateFromYmd(ymd);
  return formatDateAsIsoYmdUtc(addDays(ref, 1));
}
