import { formatDateAsIsoYmdUtc } from '../lib/iso-calendar-utc';

export function toDayPlanResponseDto(row: {
  id: string;
  householdId: string;
  date: Date;
  lunchMealId: string | null;
  dinnerMealId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    householdId: row.householdId,
    date: formatDateAsIsoYmdUtc(row.date),
    lunchMealId: row.lunchMealId,
    dinnerMealId: row.dinnerMealId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
