import type { IngredientStorageType } from '../types/enums';
import type { HouseholdId, IngredientId } from '../types/ids';

export interface IngredientResponseDto {
  id: IngredientId;
  householdId: HouseholdId;
  name: string;
  storageType: IngredientStorageType;
  perishable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientCreateDto {
  name: string;
  storageType: IngredientStorageType;
  perishable?: boolean;
}

export type IngredientUpdateDto = Partial<
  Pick<IngredientCreateDto, 'name' | 'storageType' | 'perishable'>
>;
