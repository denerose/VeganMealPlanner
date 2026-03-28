import type { IngredientStorageType } from '../types/enums';
import type { MealResponseDto } from '../dtos/meal';
import { toHouseholdId, toIngredientId, toMealId, toUserId } from '../types/ids';

export interface MealMapperMealRow {
  id: string;
  householdId: string;
  name: string;
  description: string;
  recipeUrl: string | null;
  imageId: string | null;
  makesLeftovers: boolean;
  isGreasy: boolean;
  isCreamy: boolean;
  isAcidic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MealMapperHeroRow {
  sortOrder: number;
  ingredient: {
    id: string;
    name: string;
    storageType: IngredientStorageType;
    perishable: boolean;
  };
}

export interface MealMapperInput {
  meal: MealMapperMealRow;
  heroRows: MealMapperHeroRow[];
  cookedByUserIds: string[];
}

export function toMealResponseDto(input: MealMapperInput): MealResponseDto {
  const { meal, heroRows, cookedByUserIds } = input;
  const sortedHeroes = [...heroRows].sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: toMealId(meal.id),
    householdId: toHouseholdId(meal.householdId),
    name: meal.name,
    description: meal.description,
    recipeUrl: meal.recipeUrl,
    imageId: meal.imageId,
    qualities: {
      makesLeftovers: meal.makesLeftovers,
      isGreasy: meal.isGreasy,
      isCreamy: meal.isCreamy,
      isAcidic: meal.isAcidic,
    },
    heroIngredients: sortedHeroes.map((row) => ({
      ingredientId: toIngredientId(row.ingredient.id),
      name: row.ingredient.name,
      storageType: row.ingredient.storageType,
      perishable: row.ingredient.perishable,
      sortOrder: row.sortOrder,
    })),
    cookedBy: cookedByUserIds.map(toUserId),
    createdAt: meal.createdAt.toISOString(),
    updatedAt: meal.updatedAt.toISOString(),
  };
}
