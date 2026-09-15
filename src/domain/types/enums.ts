import { IngredientStorageType } from '@prisma/client';

export { IngredientStorageType };

/** Runtime list mirroring the Prisma `IngredientStorageType` enum. */
export const INGREDIENT_STORAGE_TYPES: readonly IngredientStorageType[] =
  Object.values(IngredientStorageType);
