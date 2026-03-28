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

describe('Day plans API (integration)', () => {
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

  test('GET range returns 422 when from > to', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/day-plans?from=2026-02-10&to=2026-02-01', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);
  });

  test('GET range returns 422 when span exceeds 93 days', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/day-plans?from=2026-01-01&to=2026-05-15', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);
  });

  test('POST returns 422 for invalid calendar date', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/day-plans', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: '2026-02-31' }),
      })
    );
    expect(res.status).toBe(422);
  });

  test('POST duplicate date returns 409', async () => {
    const { userId, householdId } = seeded!;
    const date = '2026-09-01';
    await prisma.dayPlan.create({
      data: {
        householdId,
        date: planDateFromYmd(date),
        lunchMealId: null,
        dinnerMealId: null,
      },
    });

    const res = await handler(
      new Request('http://localhost/api/day-plans', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
    );
    expect(res.status).toBe(409);
  });

  test('POST /bulk returns 422 when meal not in household', async () => {
    const { userId } = seeded!;
    const other = await seedHouseholdUser();
    try {
      const foreignMeal = await prisma.meal.create({
        data: { householdId: other.householdId, name: 'Foreign', description: '' },
      });

      const res = await handler(
        new Request('http://localhost/api/day-plans/bulk', {
          method: 'POST',
          headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
          body: JSON.stringify([{ date: '2026-10-01', dinnerMealId: foreignMeal.id }]),
        })
      );
      expect(res.status).toBe(422);
    } finally {
      await teardownHouseholdUser(other);
    }
  });

  test('POST /bulk returns 422 when the same date appears twice', async () => {
    const { userId, householdId } = seeded!;
    const m1 = await prisma.meal.create({
      data: { householdId, name: 'A', description: '' },
    });
    const m2 = await prisma.meal.create({
      data: { householdId, name: 'B', description: '' },
    });
    const date = '2026-11-05';

    const res = await handler(
      new Request('http://localhost/api/day-plans/bulk', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { date, lunchMealId: m1.id },
          { date, lunchMealId: m2.id },
        ]),
      })
    );
    expect(res.status).toBe(422);
  });

  test('GET range returns 200', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/day-plans?from=2027-03-01&to=2027-03-07', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  test('POST GET PATCH DELETE day plan and POST bulk', async () => {
    const { userId, householdId } = seeded!;
    const date = '2027-04-10';
    const meal = await prisma.meal.create({
      data: { householdId, name: 'Plan meal', description: '' },
    });

    const postRes = await handler(
      new Request('http://localhost/api/day-plans', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, lunchMealId: null, dinnerMealId: null }),
      })
    );
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { id: string; date: string };
    expect(created.date).toBe(date);

    const getRes = await handler(
      new Request(`http://localhost/api/day-plans/${created.id}`, {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(getRes.status).toBe(200);

    const patchRes = await handler(
      new Request(`http://localhost/api/day-plans/${created.id}`, {
        method: 'PATCH',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ lunchMealId: meal.id }),
      })
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { lunchMealId: string | null };
    expect(patched.lunchMealId).toBe(meal.id);

    const delRes = await handler(
      new Request(`http://localhost/api/day-plans/${created.id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(delRes.status).toBe(204);

    const bulkDate = '2027-04-11';
    const bulkRes = await handler(
      new Request('http://localhost/api/day-plans/bulk', {
        method: 'POST',
        headers: { 'X-Dev-User-Id': userId, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ date: bulkDate, dinnerMealId: meal.id }]),
      })
    );
    expect(bulkRes.status).toBe(200);
    const bulkBody = (await bulkRes.json()) as { date: string }[];
    expect(Array.isArray(bulkBody)).toBe(true);
    expect(bulkBody.some((d) => d.date === bulkDate)).toBe(true);
    const row = await prisma.dayPlan.findFirst({
      where: { householdId, date: planDateFromYmd(bulkDate) },
    });
    expect(row).not.toBeNull();
    expect(row!.dinnerMealId).toBe(meal.id);
  });
});
