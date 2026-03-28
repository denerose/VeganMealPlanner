import type { IngredientStorageType } from '@prisma/client';

export function toIngredientResponseDto(row: {
  id: string;
  householdId: string;
  name: string;
  storageType: IngredientStorageType;
  perishable: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    householdId: row.householdId,
    name: row.name,
    storageType: row.storageType,
    perishable: row.perishable,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
