import { describe, expect, test } from 'bun:test';
import { IngredientStorageType } from '@prisma/client';
import { toMealResponseDto } from '../../../src/domain/mappers/meal-mapper';
import { toHouseholdId, toIngredientId, toMealId, toUserId } from '../../../src/domain/types/ids';

describe('toMealResponseDto', () => {
  test('maps flat quality flags and nested heroes', () => {
    const dto = toMealResponseDto({
      meal: {
        id: 'm1',
        householdId: 'h1',
        name: 'Soup',
        description: '',
        recipeUrl: null,
        imageId: null,
        makesLeftovers: true,
        isGreasy: false,
        isCreamy: true,
        isAcidic: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      heroRows: [
        {
          sortOrder: 1,
          ingredient: {
            id: 'i1',
            name: 'lentils',
            storageType: IngredientStorageType.PANTRY,
            perishable: false,
          },
        },
      ],
      cookedByUserIds: ['u1'],
    });

    expect(dto.qualities).toEqual({
      makesLeftovers: true,
      isGreasy: false,
      isCreamy: true,
      isAcidic: false,
    });
    expect(dto.heroIngredients[0]?.ingredientId).toEqual(toIngredientId('i1'));
    expect(dto.cookedBy).toEqual([toUserId('u1')]);
    expect(dto.id).toEqual(toMealId('m1'));
    expect(dto.householdId).toEqual(toHouseholdId('h1'));
  });
});
