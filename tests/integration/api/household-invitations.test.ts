import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import {
  resetHouseholdIntegrationData,
  type SeedHouseholdUserResult,
  seedHouseholdUser,
  seedHouseholdMember,
  teardownHouseholdMember,
  teardownHouseholdUser,
} from './helpers';

const handler = createFetchHandler(prisma);

describe('POST /api/household/invitations (integration)', () => {
  const prevAuth = process.env.AUTH_MODE;
  let seeded: SeedHouseholdUserResult;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'development';
    seeded = await seedHouseholdUser();
  });

  afterEach(async () => {
    await resetHouseholdIntegrationData(seeded.householdId);
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    await teardownHouseholdUser(seeded);
  });

  test('201 returns token and metadata', async () => {
    const email = `invitee-${crypto.randomUUID()}@integration.test`;
    const res = await handler(
      new Request('http://localhost/api/household/invitations', {
        method: 'POST',
        headers: {
          'X-Dev-User-Id': seeded.userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      token: string;
      expiresAt: string;
      email: string;
      householdId: string;
    };
    expect(body.token.length).toBeGreaterThanOrEqual(32);
    expect(body.email).toBe(email.trim().toLowerCase());
    expect(body.householdId).toBe(seeded.householdId);
    const row = await prisma.householdInvitation.findFirst({
      where: { householdId: seeded.householdId, email: body.email },
    });
    expect(row).not.toBeNull();
    expect(row!.usedAt).toBeNull();
  });

  test('422 when expiresInHours out of range', async () => {
    const res = await handler(
      new Request('http://localhost/api/household/invitations', {
        method: 'POST',
        headers: {
          'X-Dev-User-Id': seeded.userId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: 'a@b.co', expiresInHours: 999 }),
      })
    );
    expect(res.status).toBe(422);
  });

  test('403 not_household_owner for a MEMBER with no invitation row created', async () => {
    const member = await seedHouseholdMember(seeded.householdId);
    try {
      const res = await handler(
        new Request('http://localhost/api/household/invitations', {
          method: 'POST',
          headers: {
            'X-Dev-User-Id': member.userId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: `guest-${crypto.randomUUID()}@integration.test` }),
        })
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('not_household_owner');
      const count = await prisma.householdInvitation.count({
        where: { householdId: seeded.householdId },
      });
      expect(count).toBe(0);
    } finally {
      await teardownHouseholdMember(member.userId);
    }
  });
});
