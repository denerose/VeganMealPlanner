import type { IngredientStorageType } from '../types/enums';
import type { HouseholdId, IngredientId, MealId, UserId } from '../types/ids';

export interface MealQualitiesDto {
  makesLeftovers: boolean;
  isGreasy: boolean;
  isCreamy: boolean;
  isAcidic: boolean;
}

export interface MealHeroIngredientDto {
  ingredientId: IngredientId;
  name: string;
  storageType: IngredientStorageType;
  perishable: boolean;
  sortOrder: number;
}

export interface MealResponseDto {
  id: MealId;
  householdId: HouseholdId;
  name: string;
  description: string;
  recipeUrl: string | null;
  imageId: string | null;
  qualities: MealQualitiesDto;
  heroIngredients: MealHeroIngredientDto[];
  cookedBy: UserId[];
  createdAt: string;
  updatedAt: string;
}

export interface MealCreateDto {
  name: string;
  description?: string;
  recipeUrl?: string | null;
  imageId?: string | null;
  qualities?: Partial<MealQualitiesDto>;
  heroIngredientIds?: { ingredientId: IngredientId; sortOrder: number }[];
  cookedByUserIds?: UserId[];
}

export type MealUpdateDto = Partial<
  Omit<MealCreateDto, 'heroIngredientIds' | 'cookedByUserIds'>
> & {
  heroIngredientIds?: { ingredientId: IngredientId; sortOrder: number }[];
  cookedByUserIds?: UserId[];
};
