import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';

const handler = createFetchHandler(prisma);

describe('GET /api/me happy path', () => {
  const prevAuth = process.env.AUTH_MODE;
  let userId: string;
  let householdId: string;

  beforeAll(() => {
    process.env.AUTH_MODE = 'development';
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    await prisma.householdMembership.deleteMany({ where: { userId } }).catch(() => {});
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.household.delete({ where: { id: householdId } }).catch(() => {});
  });

  test('returns user and household', async () => {
    const suffix = crypto.randomUUID();
    const household = await prisma.household.create({ data: { name: `H-${suffix}` } });
    householdId = household.id;
    const user = await prisma.user.create({ data: { displayName: 'Pat' } });
    userId = user.id;
    await prisma.householdMembership.create({
      data: { userId, householdId },
    });

    const res = await handler(
      new Request('http://localhost/api/me', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; displayName: string | null };
      household: { id: string; name: string | null };
    };
    expect(body.user.id).toBe(userId);
    expect(body.household.id).toBe(householdId);
  });
});

describe('GET /api/me without membership', () => {
  const prevAuth = process.env.AUTH_MODE;
  let strayUserId: string;

  beforeAll(() => {
    process.env.AUTH_MODE = 'development';
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    await prisma.user.delete({ where: { id: strayUserId } }).catch(() => {});
  });

  test('403 user_not_in_household', async () => {
    const u = await prisma.user.create({ data: { displayName: 'Lonely' } });
    strayUserId = u.id;
    const res = await handler(
      new Request('http://localhost/api/me', {
        headers: { 'X-Dev-User-Id': u.id },
      })
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('user_not_in_household');
  });
});
