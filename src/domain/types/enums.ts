import { IngredientStorageType, MealLeftovers } from '@prisma/client';

export { IngredientStorageType, MealLeftovers };

/** Runtime list mirroring the Prisma `IngredientStorageType` enum. */
export const INGREDIENT_STORAGE_TYPES: readonly IngredientStorageType[] =
  Object.values(IngredientStorageType);

/**
 * Wire format for `Meal.leftovers` (Prisma `MealLeftovers`), lowercase like
 * the rest of the API surface:
 * - `always` — meal inherently over-produces ("makes a big pot", lasagna
 *   pan); surplus needs a destination (next-day meal, deliberate freeze)
 * - `never` — doesn't keep / doesn't travel; no queue role
 * - `optionally` — batch size is the cook's dial ("make double sauce") when
 *   demand exists
 */
export type MealLeftoversValue = 'always' | 'never' | 'optionally';

/** Runtime list of the lowercase wire values. */
export const MEAL_LEFTOVERS_VALUES: readonly MealLeftoversValue[] = [
  'always',
  'never',
  'optionally',
];

export function isMealLeftoversValue(v: unknown): v is MealLeftoversValue {
  return typeof v === 'string' && (MEAL_LEFTOVERS_VALUES as readonly string[]).includes(v);
}

/** Prisma enum -> lowercase wire value. */
export function mealLeftoversToValue(v: MealLeftovers): MealLeftoversValue {
  return v.toLowerCase() as MealLeftoversValue;
}

/** Lowercase wire value -> Prisma enum. */
export function mealLeftoversFromValue(v: MealLeftoversValue): MealLeftovers {
  return v.toUpperCase() as MealLeftovers;
}
