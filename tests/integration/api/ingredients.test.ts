import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { IngredientStorageType } from '@prisma/client';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import { seedHouseholdUser } from './helpers';

const handler = createFetchHandler(prisma);

describe('Ingredients API (integration)', () => {
  const prevAuth = process.env.AUTH_MODE;

  beforeAll(() => {
    process.env.AUTH_MODE = 'development';
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
  });

  test('409 on duplicate normalized name', async () => {
    const s = await seedHouseholdUser();
    const { userId, householdId } = s;

    const headers = { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' };
    const body = JSON.stringify({
      name: '  Olive Oil ',
      storageType: IngredientStorageType.PANTRY,
    });
    const r1 = await handler(
      new Request('http://localhost/api/ingredients', { method: 'POST', headers, body })
    );
    expect(r1.status).toBe(201);

    const r2 = await handler(
      new Request('http://localhost/api/ingredients', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'olive oil',
          storageType: IngredientStorageType.PANTRY,
        }),
      })
    );
    expect(r2.status).toBe(409);

    await prisma.ingredient.deleteMany({ where: { householdId } });
    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });

  test('409 ingredient_in_use when hero-linked', async () => {
    const s = await seedHouseholdUser();
    const { userId: uid, householdId: hid } = s;

    const ing = await prisma.ingredient.create({
      data: {
        householdId: hid,
        name: `hero-${s.suffix}`,
        storageType: IngredientStorageType.FRESH,
      },
    });
    const meal = await prisma.meal.create({
      data: { householdId: hid, name: 'Salad', description: '' },
    });
    await prisma.mealHeroIngredient.create({
      data: { mealId: meal.id, ingredientId: ing.id, sortOrder: 0 },
    });

    const res = await handler(
      new Request(`http://localhost/api/ingredients/${ing.id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': uid },
      })
    );
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code: string };
    expect(j.code).toBe('ingredient_in_use');

    await prisma.mealHeroIngredient.delete({
      where: { mealId_ingredientId: { mealId: meal.id, ingredientId: ing.id } },
    });
    await prisma.meal.delete({ where: { id: meal.id } });
    await prisma.ingredient.delete({ where: { id: ing.id } });
    await prisma.householdMembership.deleteMany({ where: { householdId: hid } });
    await prisma.user.delete({ where: { id: uid } });
    await prisma.household.delete({ where: { id: hid } });
  });
});
