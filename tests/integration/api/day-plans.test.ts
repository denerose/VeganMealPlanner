import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import { planDateFromYmd } from '../../../src/domain/lib/plan-date';
import { seedHouseholdUser } from './helpers';

const handler = createFetchHandler(prisma);

describe('Day plans API (integration)', () => {
  const prevAuth = process.env.AUTH_MODE;

  beforeAll(() => {
    process.env.AUTH_MODE = 'development';
  });

  afterAll(() => {
    process.env.AUTH_MODE = prevAuth;
  });

  test('GET range returns 422 when from > to', async () => {
    const { userId, householdId } = await seedHouseholdUser();
    const res = await handler(
      new Request('http://localhost/api/day-plans?from=2026-02-10&to=2026-02-01', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);

    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });

  test('GET range returns 422 when span exceeds 93 days', async () => {
    const { userId, householdId } = await seedHouseholdUser();
    const res = await handler(
      new Request('http://localhost/api/day-plans?from=2026-01-01&to=2026-05-15', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(422);

    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });

  test('POST duplicate date returns 409', async () => {
    const { userId, householdId } = await seedHouseholdUser();
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

    await prisma.dayPlan.deleteMany({ where: { householdId } });
    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });

  test('POST /bulk returns 422 when meal not in household', async () => {
    const { userId, householdId } = await seedHouseholdUser();
    const other = await seedHouseholdUser();
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

    await prisma.meal.delete({ where: { id: foreignMeal.id } });
    await prisma.householdMembership.deleteMany({ where: { householdId: other.householdId } });
    await prisma.user.delete({ where: { id: other.userId } });
    await prisma.household.delete({ where: { id: other.householdId } });

    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });

  test('POST /bulk upserts same date — last item wins', async () => {
    const { userId, householdId } = await seedHouseholdUser();
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
    expect(res.status).toBe(200);
    const plan = await prisma.dayPlan.findFirst({
      where: { householdId, date: planDateFromYmd(date) },
    });
    expect(plan?.lunchMealId).toBe(m2.id);

    await prisma.dayPlan.deleteMany({ where: { householdId } });
    await prisma.meal.deleteMany({ where: { householdId } });
    await prisma.householdMembership.deleteMany({ where: { householdId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.household.delete({ where: { id: householdId } });
  });
});
