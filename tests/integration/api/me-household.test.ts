import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import {
  resetHouseholdIntegrationData,
  type SeedHouseholdUserResult,
  seedHouseholdUser,
  teardownHouseholdUser,
} from './helpers';

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
    const user = await prisma.user.create({
      data: {
        email: `pat-${suffix}@integration.test`,
        displayName: 'Pat',
      },
    });
    userId = user.id;
    await prisma.householdMembership.create({
      data: { userId, householdId, role: 'OWNER' },
    });

    const res = await handler(
      new Request('http://localhost/api/me', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      user: { id: string; email: string; displayName: string | null };
      household: { id: string; name: string | null };
      membershipRole: string;
    };
    expect(body.user.id).toBe(userId);
    expect(body.user.email).toBe(`pat-${suffix}@integration.test`);
    expect(body.membershipRole).toBe('OWNER');
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
    const u = await prisma.user.create({
      data: {
        email: `lonely-${crypto.randomUUID()}@integration.test`,
        displayName: 'Lonely',
      },
    });
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

describe('GET /api/me multiple memberships', () => {
  const prevAuth = process.env.AUTH_MODE;
  let multiUserId: string;
  let h1: string;
  let h2: string;

  beforeAll(() => {
    process.env.AUTH_MODE = 'development';
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    await prisma.householdMembership.deleteMany({ where: { userId: multiUserId } }).catch(() => {});
    await prisma.user.delete({ where: { id: multiUserId } }).catch(() => {});
    await prisma.household.delete({ where: { id: h1 } }).catch(() => {});
    await prisma.household.delete({ where: { id: h2 } }).catch(() => {});
  });

  test('409 multiple_memberships', async () => {
    const suffix = crypto.randomUUID();
    h1 = (await prisma.household.create({ data: { name: `M1-${suffix}` } })).id;
    h2 = (await prisma.household.create({ data: { name: `M2-${suffix}` } })).id;
    const user = await prisma.user.create({
      data: {
        email: `multi-${suffix}@integration.test`,
        displayName: 'Multi',
      },
    });
    multiUserId = user.id;
    await prisma.householdMembership.create({
      data: { userId: multiUserId, householdId: h1, role: 'OWNER' },
    });
    await prisma.householdMembership.create({
      data: { userId: multiUserId, householdId: h2, role: 'MEMBER' },
    });

    const res = await handler(
      new Request('http://localhost/api/me', {
        headers: { 'X-Dev-User-Id': multiUserId },
      })
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('multiple_memberships');
  });
});

describe('PATCH /api/me, /api/household, /api/household/members', () => {
  const prevAuth = process.env.AUTH_MODE;
  let seeded: SeedHouseholdUserResult | undefined;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'development';
    seeded = await seedHouseholdUser();
  });

  afterEach(async () => {
    if (!seeded) return;
    await resetHouseholdIntegrationData(seeded.householdId);
    await prisma.household.update({
      where: { id: seeded.householdId },
      data: { name: `H-${seeded.suffix}` },
    });
    await prisma.user.update({
      where: { id: seeded.userId },
      data: { displayName: `U-${seeded.suffix}` },
    });
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    if (seeded) await teardownHouseholdUser(seeded);
  });

  test('PATCH /api/me updates displayName', async () => {
    const { userId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/me', {
        method: 'PATCH',
        headers: {
          'X-Dev-User-Id': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Updated Pat' }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { displayName: string | null };
    expect(body.displayName).toBe('Updated Pat');
  });

  test('GET /api/household returns seeded household', async () => {
    const { userId, householdId, suffix } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/household', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; name: string | null };
    expect(body.id).toBe(householdId);
    expect(body.name).toBe(`H-${suffix}`);
  });

  test('PATCH /api/household renames household', async () => {
    const { userId, householdId } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/household', {
        method: 'PATCH',
        headers: {
          'X-Dev-User-Id': userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Renamed Plant Kitchen' }),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; name: string | null };
    expect(body.id).toBe(householdId);
    expect(body.name).toBe('Renamed Plant Kitchen');
  });

  test('GET /api/household/members includes seeded owner', async () => {
    const { userId, suffix } = seeded!;
    const res = await handler(
      new Request('http://localhost/api/household/members', {
        headers: { 'X-Dev-User-Id': userId },
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      userId: string;
      role: string;
      displayName: string | null;
    }[];
    const row = body.find((m) => m.userId === userId);
    expect(row).toBeDefined();
    expect(row!.role).toBe('OWNER');
    expect(row!.displayName).toBe(`U-${suffix}`);
  });
});
