export type HouseholdId = string & { readonly __brand: 'HouseholdId' };
export type UserId = string & { readonly __brand: 'UserId' };
export type MealId = string & { readonly __brand: 'MealId' };
export type IngredientId = string & { readonly __brand: 'IngredientId' };
export type DayPlanId = string & { readonly __brand: 'DayPlanId' };

export function toHouseholdId(id: string): HouseholdId {
  return id as HouseholdId;
}
export function toUserId(id: string): UserId {
  return id as UserId;
}
export function toMealId(id: string): MealId {
  return id as MealId;
}
export function toIngredientId(id: string): IngredientId {
  return id as IngredientId;
}
export function toDayPlanId(id: string): DayPlanId {
  return id as DayPlanId;
}
