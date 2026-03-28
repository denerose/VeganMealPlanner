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
});
