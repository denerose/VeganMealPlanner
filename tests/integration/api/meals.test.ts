import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import { planDateFromYmd } from '../../../src/domain/lib/plan-date';
import {
  resetHouseholdIntegrationData,
  type SeedHouseholdUserResult,
  seedHouseholdUser,
  teardownHouseholdUser,
} from './helpers';

const handler = createFetchHandler(prisma);

describe('Meals API (integration)', () => {
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

  test('GET /api/meals/random excludes prior and next day dinners', async () => {
    const { userId, householdId } = seeded!;
    const m1 = await prisma.meal.create({
      data: { householdId, name: 'PrevDinner', description: '' },
    });
    const m2 = await prisma.meal.create({
      data: { householdId, name: 'NextDinner', description: '' },
    });
    const m3 = await prisma.meal.create({
      data: { householdId, name: 'OnlyPick', description: '' },
    });

    const d0 = '2026-06-10';
    const dPrev = '2026-06-09';
    const dNext = '2026-06-11';

    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd(dPrev),
        lunchMealId: null,
        dinnerMealId: m1.id,
      },
    });
    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd(dNext),
        lunchMealId: null,
        dinnerMealId: m2.id,
      },
    });

    const res = await handler(
      new Request(`http://localhost/api/meals/random?date=${d0}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(m3.id);
  });

  test('POST /api/meals/random returns 405', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/meals/random', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET');
  });

  test('GET /api/meals/random respects isGreasy filter', async () => {
    const { userId, householdId } = seeded!;
    await prisma.meal.create({
      data: { householdId, name: 'Greasy', description: '', isGreasy: true },
    });
    const clean = await prisma.meal.create({
      data: { householdId, name: 'Clean', description: '', isGreasy: false },
    });
    const d0 = '2026-12-01';
    const res = await handler(
      new Request(`http://localhost/api/meals/random?date=${d0}&isGreasy=false`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string };
    expect(body.id).toBe(clean.id);
  });

  test('GET /api/meals/random returns no_eligible_meals when filter excludes all', async () => {
    const { userId, householdId } = seeded!;
    await prisma.meal.create({
      data: { householdId, name: 'OnlyGreasy', description: '', isGreasy: true },
    });
    const res = await handler(
      new Request('http://localhost/api/meals/random?date=2026-12-02&isGreasy=false', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('no_eligible_meals');
  });

  test('GET /api/meals returns 422 when heroIngredientId is not a UUID', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/meals?heroIngredientId=not-a-uuid', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('invalid_query');
  });

  test('GET /api/meals/random without date returns 422', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/meals/random', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);
  });

  test('GET /api/meals/random returns 404 no_eligible_meals when pool empty', async () => {
    const { userId, householdId } = seeded!;
    const only = await prisma.meal.create({
      data: { householdId, name: 'Solo', description: '' },
    });
    const d0 = '2026-07-01';
    const dPrev = '2026-06-30';
    const dNext = '2026-07-02';
    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd(dPrev),
        dinnerMealId: only.id,
        lunchMealId: null,
      },
    });
    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd(dNext),
        dinnerMealId: only.id,
        lunchMealId: null,
      },
    });

    const res = await handler(
      new Request(`http://localhost/api/meals/random?date=${d0}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('no_eligible_meals');
  });

  test('POST /api/meals with invalid cookedByUserIds returns 422', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/meals', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'X',
          cookedByUserIds: ['00000000-0000-4000-8000-000000000001'],
        }),
      })
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('cooked_by_invalid');
  });

  test('DELETE /api/meals returns 409 meal_in_use when linked from day plan', async () => {
    const { userId, householdId } = seeded!;
    const meal = await prisma.meal.create({
      data: { householdId, name: 'Locked', description: '' },
    });
    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd('2026-08-01'),
        lunchMealId: meal.id,
        dinnerMealId: null,
      },
    });

    const res = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('meal_in_use');
  });

  test('GET /api/meals returns 200 list', async () => {
    const { userId, householdId } = seeded!;
    await prisma.meal.create({
      data: { householdId, name: 'ListMeal', description: 'Chickpea bowl' },
    });
    const res = await handler(
      new Request('http://localhost/api/meals', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((m) => m.name === 'ListMeal')).toBe(true);
  });

  test('POST /api/meals minimal body returns 201', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/meals', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Simple tofu stir-fry' }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string; id: string };
    expect(body.name).toBe('Simple tofu stir-fry');
    expect(body.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('GET and PATCH /api/meals/{id}', async () => {
    const { userId, householdId } = seeded!;
    const meal = await prisma.meal.create({
      data: { householdId, name: 'Before patch', description: '' },
    });
    const getRes = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(getRes.status).toBe(200);
    const getBody = (await getRes.json()) as { name: string };
    expect(getBody.name).toBe('Before patch');

    const patchRes = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'After patch' }),
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as { name: string };
    expect(patchBody.name).toBe('After patch');
  });

  test('POST /api/meals round-trips optional/grouped heroes and leftover sources', async () => {
    const { userId, householdId } = seeded!;
    const ing = await prisma.ingredient.create({
      data: {
        householdId,
        name: 'stuffing mix',
        storageType: 'PANTRY',
      } as never,
    });
    const soup = await prisma.meal.create({
      data: { householdId, name: 'Veggie Soup', description: '', makesLeftovers: true },
    });

    const res = await handler(
      new Request('http://localhost/api/meals', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Soupy Sausage Rolls',
          heroIngredientIds: [
            { ingredientId: ing.id, optional: true, substitutionGroup: 'binder' },
          ],
          leftoverSourceMealIds: [soup.id],
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      heroIngredients: {
        ingredientId: string;
        optional: boolean;
        substitutionGroup: string | null;
      }[];
      leftoverSources: { mealId: string; name: string }[];
    };
    expect(body.heroIngredients).toHaveLength(1);
    expect(body.heroIngredients[0]).toMatchObject({
      ingredientId: ing.id,
      optional: true,
      substitutionGroup: 'binder',
    });
    expect(body.leftoverSources).toEqual([{ mealId: soup.id, name: 'Veggie Soup' }]);

    const getRes = await handler(
      new Request(`http://localhost/api/meals/${body.id}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    const getBody = (await getRes.json()) as typeof body;
    expect(getBody.leftoverSources).toEqual([{ mealId: soup.id, name: 'Veggie Soup' }]);
    expect(getBody.heroIngredients[0]).toMatchObject({
      optional: true,
      substitutionGroup: 'binder',
    });
  });

  test('POST /api/meals rejects source meal without makesLeftovers', async () => {
    const { userId, householdId } = seeded!;
    const notLeftover = await prisma.meal.create({
      data: { householdId, name: 'Fresh Salad', description: '', makesLeftovers: false },
    });
    const res = await handler(
      new Request('http://localhost/api/meals', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'X', leftoverSourceMealIds: [notLeftover.id] }),
      })
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('invalid_leftover_source');
  });

  test('POST /api/meals rejects cross-household source meal', async () => {
    const { userId } = seeded!;
    const other = await prisma.household.create({ data: { name: 'Other House' } });
    try {
      const foreign = await prisma.meal.create({
        data: {
          householdId: other.id,
          name: 'Foreign Soup',
          description: '',
          makesLeftovers: true,
        },
      });
      const res = await handler(
        new Request('http://localhost/api/meals', {
          method: 'POST',
          headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'X', leftoverSourceMealIds: [foreign.id] }),
        })
      );
      expect(res.status).toBe(422);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('invalid_leftover_source');
    } finally {
      await prisma.meal.deleteMany({ where: { householdId: other.id } });
      await prisma.household.delete({ where: { id: other.id } });
    }
  });

  test('PATCH /api/meals/{id} replaces leftover sources and rejects self-reference', async () => {
    const { userId, householdId } = seeded!;
    const meal = await prisma.meal.create({
      data: { householdId, name: 'Consumer', description: '' },
    });
    const soup = await prisma.meal.create({
      data: { householdId, name: 'Lentil Soup', description: '', makesLeftovers: true },
    });

    const selfRes = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftoverSourceMealIds: [meal.id] }),
      })
    );
    expect(selfRes.status).toBe(422);
    expect(((await selfRes.json()) as { code: string }).code).toBe('invalid_leftover_source');

    const okRes = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftoverSourceMealIds: [soup.id] }),
      })
    );
    expect(okRes.status).toBe(200);
    expect(((await okRes.json()) as { leftoverSources: unknown[] }).leftoverSources).toEqual([
      { mealId: soup.id, name: 'Lentil Soup' },
    ]);

    const clearRes = await handler(
      new Request(`http://localhost/api/meals/${meal.id}`, {
        method: 'PATCH',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ leftoverSourceMealIds: [] }),
      })
    );
    expect(clearRes.status).toBe(200);
    expect(((await clearRes.json()) as { leftoverSources: unknown[] }).leftoverSources).toEqual([]);
  });

  test('DELETE /api/meals returns 409 leftover_source_in_use when consumed by another meal', async () => {
    const { userId, householdId } = seeded!;
    const soup = await prisma.meal.create({
      data: { householdId, name: 'Ref Soup', description: '', makesLeftovers: true },
    });
    await prisma.meal.create({
      data: {
        householdId,
        name: 'Soup Eater',
        description: '',
        leftoverSourcesConsumed: { create: [{ sourceMealId: soup.id }] },
      },
    });

    const res = await handler(
      new Request(`http://localhost/api/meals/${soup.id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('leftover_source_in_use');
  });
});
