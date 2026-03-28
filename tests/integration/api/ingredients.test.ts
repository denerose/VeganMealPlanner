import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { IngredientStorageType } from '@prisma/client';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import {
  resetHouseholdIntegrationData,
  type SeedHouseholdUserResult,
  seedHouseholdUser,
  teardownHouseholdUser,
} from './helpers';

const handler = createFetchHandler(prisma);

describe('Ingredients API (integration)', () => {
  const prevAuth = process.env.AUTH_MODE;
  let seeded: SeedHouseholdUserResult | undefined;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'development';
    seeded = await seedHouseholdUser();
  });

  afterEach(async () => {
    if (seeded) await resetHouseholdIntegrationData(seeded.householdId);
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    if (seeded) await teardownHouseholdUser(seeded);
  });

  test('409 on duplicate normalized name', async () => {
    const { userId } = seeded!;

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
    const dup = (await r2.json()) as { code: string };
    expect(dup.code).toBe('ingredient_name_conflict');
  });

  test('409 ingredient_in_use when hero-linked', async () => {
    const { userId, householdId, suffix } = seeded!;

    const ing = await prisma.ingredient.create({
      data: {
        householdId,
        name: `hero-${suffix}`,
        storageType: IngredientStorageType.FRESH,
      },
    });
    const meal = await prisma.meal.create({
      data: { householdId, name: 'Salad', description: '' },
    });
    await prisma.mealHeroIngredient.create({
      data: { mealId: meal.id, ingredientId: ing.id, sortOrder: 0 },
    });

    const res = await handler(
      new Request(`http://localhost/api/ingredients/${ing.id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(409);
    const j = (await res.json()) as { code: string };
    expect(j.code).toBe('ingredient_in_use');
  });

  test('POST 201 then GET list, GET by id, PATCH rename', async () => {
    const { userId } = seeded!;
    const headers = { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' };
    const createRes = await handler(
      new Request('http://localhost/api/ingredients', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: '  Tahini ',
          storageType: IngredientStorageType.PANTRY,
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { id: string; name: string };
    expect(created.name.toLowerCase()).toContain('tahini');

    const listRes = await handler(
      new Request('http://localhost/api/ingredients', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(listRes.status).toBe(200);
    const list = (await listRes.json()) as { id: string }[];
    expect(list.some((r) => r.id === created.id)).toBe(true);

    const getRes = await handler(
      new Request(`http://localhost/api/ingredients/${created.id}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(getRes.status).toBe(200);

    const patchRes = await handler(
      new Request(`http://localhost/api/ingredients/${created.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Organic Tahini' }),
      })
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { name: string };
    expect(patched.name.toLowerCase()).toContain('tahini');
  });

  test('GET /api/ingredients/{id} unknown id returns 404 not_found', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/ingredients/00000000-0000-4000-8000-000000000099', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('not_found');
  });
});
