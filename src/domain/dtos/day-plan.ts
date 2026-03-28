/**
 * Day plans are keyed by (householdId, date) at create time.
 * MVP: updates only change lunch/dinner meal ids, not the calendar date.
 */
import type { DayPlanId, HouseholdId, MealId } from '../types/ids';

export interface DayPlanResponseDto {
  id: DayPlanId;
  householdId: HouseholdId;
  /** ISO calendar date YYYY-MM-DD */
  date: string;
  lunchMealId: MealId | null;
  dinnerMealId: MealId | null;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlanCreateDto {
  /** YYYY-MM-DD */
  date: string;
  lunchMealId?: MealId | null;
  dinnerMealId?: MealId | null;
}

export type DayPlanUpdateDto = Partial<Pick<DayPlanCreateDto, 'lunchMealId' | 'dinnerMealId'>>;
