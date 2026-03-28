import { describe, expect, test } from 'bun:test';
import { prisma } from '../../src/lib/prisma';
import { planDateFromYmd } from '../../src/domain/lib/plan-date';
import { IngredientStorageType } from '@prisma/client';

describe('Prisma schema (integration)', () => {
  test('creates household, user, membership, meal, ingredient, day plan', async () => {
    const suffix = crypto.randomUUID();
    const household = await prisma.household.create({
      data: { name: `H-${suffix}` },
    });
    const user = await prisma.user.create({
      data: { displayName: 'Chef' },
    });
    await prisma.householdMembership.create({
      data: { userId: user.id, householdId: household.id },
    });
    const meal = await prisma.meal.create({
      data: {
        householdId: household.id,
        name: 'Soup',
        description: '',
      },
    });
    const ing = await prisma.ingredient.create({
      data: {
        householdId: household.id,
        name: `tofu-${suffix}`,
        storageType: IngredientStorageType.REFRIGERATED,
        perishable: true,
      },
    });
    await prisma.mealHeroIngredient.create({
      data: { mealId: meal.id, ingredientId: ing.id, sortOrder: 0 },
    });
    await prisma.mealCookedBy.create({
      data: { mealId: meal.id, userId: user.id },
    });
    const plan = await prisma.dayPlan.create({
      data: {
        householdId: household.id,
        date: planDateFromYmd('2026-03-15'),
        lunchMealId: meal.id,
        dinnerMealId: null,
      },
    });
    expect(plan.householdId).toBe(household.id);

    await prisma.dayPlan.delete({ where: { id: plan.id } });
    await prisma.mealHeroIngredient.delete({
      where: { mealId_ingredientId: { mealId: meal.id, ingredientId: ing.id } },
    });
    await prisma.mealCookedBy.delete({
      where: { mealId_userId: { mealId: meal.id, userId: user.id } },
    });
    await prisma.meal.delete({ where: { id: meal.id } });
    await prisma.ingredient.delete({ where: { id: ing.id } });
    await prisma.householdMembership.delete({
      where: { userId_householdId: { userId: user.id, householdId: household.id } },
    });
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.household.delete({ where: { id: household.id } });
  });
});
