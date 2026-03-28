import { describe, expect, test } from 'bun:test';
import { prisma } from '../../src/lib/prisma';
import { planDateFromYmd } from '../../src/domain/lib/plan-date';
import { IngredientStorageType } from '@prisma/client';

describe('Prisma schema (integration)', () => {
  test('creates household, user, membership, meal, ingredient, day plan', async () => {
    const suffix = crypto.randomUUID();
    const ids: {
      planId?: string;
      mealId?: string;
      ingredientId?: string;
      userId?: string;
      householdId?: string;
    } = {};

    try {
      const household = await prisma.household.create({
        data: { name: `H-${suffix}` },
      });
      ids.householdId = household.id;

      const user = await prisma.user.create({
        data: {
          email: `chef-${suffix}@integration.test`,
          displayName: 'Chef',
        },
      });
      ids.userId = user.id;

      await prisma.householdMembership.create({
        data: {
          userId: user.id,
          householdId: household.id,
          role: 'OWNER',
        },
      });

      const meal = await prisma.meal.create({
        data: {
          householdId: household.id,
          name: 'Soup',
          description: '',
        },
      });
      ids.mealId = meal.id;

      const ing = await prisma.ingredient.create({
        data: {
          householdId: household.id,
          name: `tofu-${suffix}`,
          storageType: IngredientStorageType.REFRIGERATED,
          perishable: true,
        },
      });
      ids.ingredientId = ing.id;

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
      ids.planId = plan.id;

      expect(plan.householdId).toBe(household.id);
    } finally {
      const { planId, mealId, ingredientId, userId, householdId } = ids;
      if (planId) await prisma.dayPlan.delete({ where: { id: planId } }).catch(() => {});
      if (mealId && ingredientId) {
        await prisma.mealHeroIngredient
          .delete({
            where: { mealId_ingredientId: { mealId, ingredientId } },
          })
          .catch(() => {});
      }
      if (mealId && userId) {
        await prisma.mealCookedBy
          .delete({
            where: { mealId_userId: { mealId, userId } },
          })
          .catch(() => {});
      }
      if (mealId) await prisma.meal.delete({ where: { id: mealId } }).catch(() => {});
      if (ingredientId)
        await prisma.ingredient.delete({ where: { id: ingredientId } }).catch(() => {});
      if (userId && householdId) {
        await prisma.householdMembership
          .delete({
            where: { userId_householdId: { userId, householdId } },
          })
          .catch(() => {});
      }
      if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      if (householdId)
        await prisma.household.delete({ where: { id: householdId } }).catch(() => {});
    }
  });
});
