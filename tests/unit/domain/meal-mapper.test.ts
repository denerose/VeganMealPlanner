import { describe, expect, test } from 'bun:test';
import { IngredientStorageType, MealLeftovers } from '@prisma/client';
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
        leftovers: MealLeftovers.ALWAYS,
        isEasyToMake: true,
        isGreasy: false,
        isCreamy: true,
        isAcidic: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      },
      heroRows: [
        {
          sortOrder: 1,
          optional: false,
          substitutionGroup: null,
          ingredient: {
            id: 'i1',
            name: 'lentils',
            storageType: IngredientStorageType.PANTRY,
            perishable: false,
          },
        },
      ],
      cookedByUserIds: ['u1'],
      leftoverSourceRows: [],
    });

    expect(dto.qualities).toEqual({
      leftovers: 'always',
      isEasyToMake: true,
      isGreasy: false,
      isCreamy: true,
      isAcidic: false,
    });
    expect(dto.heroIngredients[0]?.ingredientId).toEqual(toIngredientId('i1'));
    expect(dto.cookedBy).toEqual([toUserId('u1')]);
    expect(dto.id).toEqual(toMealId('m1'));
    expect(dto.householdId).toEqual(toHouseholdId('h1'));
  });

  test('sorts hero ingredients by sortOrder', () => {
    const dto = toMealResponseDto({
      meal: {
        id: 'm1',
        householdId: 'h1',
        name: 'Bowl',
        description: '',
        recipeUrl: null,
        imageId: null,
        leftovers: MealLeftovers.NEVER,
        isEasyToMake: false,
        isGreasy: false,
        isCreamy: false,
        isAcidic: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      heroRows: [
        {
          sortOrder: 2,
          optional: false,
          substitutionGroup: null,
          ingredient: {
            id: 'i2',
            name: 'second',
            storageType: IngredientStorageType.FRESH,
            perishable: true,
          },
        },
        {
          sortOrder: 0,
          optional: false,
          substitutionGroup: null,
          ingredient: {
            id: 'i0',
            name: 'first',
            storageType: IngredientStorageType.PANTRY,
            perishable: false,
          },
        },
      ],
      cookedByUserIds: [],
      leftoverSourceRows: [],
    });

    expect(dto.heroIngredients.map((h) => h.ingredientId)).toEqual([
      toIngredientId('i0'),
      toIngredientId('i2'),
    ]);
  });

  test('maps hero optional/substitutionGroup and leftover sources', () => {
    const dto = toMealResponseDto({
      meal: {
        id: 'm1',
        householdId: 'h1',
        name: 'Soupy Sausage Rolls',
        description: '',
        recipeUrl: null,
        imageId: null,
        leftovers: MealLeftovers.OPTIONALLY,
        isEasyToMake: true,
        isGreasy: false,
        isCreamy: false,
        isAcidic: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      heroRows: [
        {
          sortOrder: 0,
          optional: true,
          substitutionGroup: 'binder',
          ingredient: {
            id: 'i1',
            name: 'stuffing mix',
            storageType: IngredientStorageType.PANTRY,
            perishable: false,
          },
        },
        {
          sortOrder: 1,
          optional: false,
          substitutionGroup: null,
          ingredient: {
            id: 'i2',
            name: 'puff pastry',
            storageType: IngredientStorageType.FROZEN,
            perishable: true,
          },
        },
      ],
      cookedByUserIds: [],
      leftoverSourceRows: [
        { mealId: 'm9', name: 'Veggie Soup' },
        { mealId: 'm8', name: 'Lentil Soup' },
      ],
    });

    expect(dto.heroIngredients[0]).toMatchObject({
      ingredientId: toIngredientId('i1'),
      optional: true,
      substitutionGroup: 'binder',
    });
    expect(dto.heroIngredients[1]).toMatchObject({
      ingredientId: toIngredientId('i2'),
      optional: false,
      substitutionGroup: null,
    });
    expect(dto.leftoverSources).toEqual([
      { mealId: toMealId('m9'), name: 'Veggie Soup' },
      { mealId: toMealId('m8'), name: 'Lentil Soup' },
    ]);
  });
});
