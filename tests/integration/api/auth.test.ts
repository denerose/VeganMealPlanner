import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import { hashInviteTokenPlaintext } from '../../../src/api/lib/invite-token-hash';
import { normalizeEmail } from '../../../src/domain/lib/normalize-email';
import {
  resetHouseholdIntegrationData,
  type SeedHouseholdUserResult,
  seedHouseholdUser,
  teardownHouseholdUser,
} from './helpers';

const handler = createFetchHandler(prisma);

const JWT_SECRET = 'integration-test-jwt-secret-32chars!!';
const JWT_EXPIRES_IN = '3600';

describe('Auth API (integration, production auth)', () => {
  const prevAuth = process.env.AUTH_MODE;
  const prevSecret = process.env.JWT_SECRET;
  const prevExp = process.env.JWT_EXPIRES_IN;
  let seeded: SeedHouseholdUserResult;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'production';
    process.env.JWT_SECRET = JWT_SECRET;
    process.env.JWT_EXPIRES_IN = JWT_EXPIRES_IN;
    seeded = await seedHouseholdUser();
  });

  afterEach(async () => {
    await resetHouseholdIntegrationData(seeded.householdId);
    await prisma.householdInvitation.deleteMany({ where: { householdId: seeded.householdId } });
    await prisma.user.deleteMany({
      where: {
        email: { endsWith: '@integration.test' },
        NOT: { id: seeded.userId },
      },
    });
    await prisma.household.deleteMany({
      where: { memberships: { none: {} } },
    });
  });

  afterAll(async () => {
    await teardownHouseholdUser(seeded);
    process.env.AUTH_MODE = prevAuth;
    if (prevSecret !== undefined) process.env.JWT_SECRET = prevSecret;
    else delete process.env.JWT_SECRET;
    if (prevExp !== undefined) process.env.JWT_EXPIRES_IN = prevExp;
    else delete process.env.JWT_EXPIRES_IN;
  });

  test('POST /api/auth/register create path returns 201 and OWNER household', async () => {
    const suffix = crypto.randomUUID();
    const email = `reg-${suffix}@integration.test`;
    const password = 'correcthorsebatterystaple';
    const res = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName: 'Reg User',
          householdName: 'Plant Kitchen',
        }),
      })
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      accessToken: string;
      tokenType: string;
      expiresIn: number;
      user: { id: string; email: string; displayName: string | null };
    };
    expect(body.tokenType).toBe('Bearer');
    expect(body.user.email).toBe(normalizeEmail(email));
    const user = await prisma.user.findUnique({ where: { id: body.user.id } });
    expect(user).not.toBeNull();
    const memberships = await prisma.householdMembership.findMany({
      where: { userId: body.user.id },
    });
    expect(memberships).toHaveLength(1);
    expect(memberships[0]!.role).toBe('OWNER');
    expect(memberships[0]!.householdId).not.toBe(seeded.householdId);
  });

  test('POST /api/auth/register join path consumes invite and sets MEMBER', async () => {
    const suffix = crypto.randomUUID();
    const inviteeEmail = `join-${suffix}@integration.test`;
    const plaintextToken = `j-${suffix}`.replace(/-/g, '').slice(0, 32).padEnd(32, '0');
    const tokenHash = hashInviteTokenPlaintext(plaintextToken);
    await prisma.householdInvitation.create({
      data: {
        householdId: seeded.householdId,
        email: normalizeEmail(inviteeEmail),
        tokenHash,
        createdByUserId: seeded.userId,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });

    const res = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteeEmail,
          password: 'anotherlongpassword',
          householdInviteToken: plaintextToken,
        }),
      })
    );
    expect(res.status).toBe(201);
    const regBody = (await res.json()) as { user: { id: string } };
    const m = await prisma.householdMembership.findUnique({
      where: {
        userId_householdId: { userId: regBody.user.id, householdId: seeded.householdId },
      },
    });
    expect(m?.role).toBe('MEMBER');
    const inv = await prisma.householdInvitation.findUnique({ where: { tokenHash } });
    expect(inv?.usedAt).not.toBeNull();
    expect(inv?.usedByUserId).toBe(regBody.user.id);

    const loginRes = await handler(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteeEmail, password: 'anotherlongpassword' }),
      })
    );
    const token = ((await loginRes.json()) as { accessToken: string }).accessToken;
    const listRes = await handler(
      new Request('http://localhost/api/household/members', {
        headers: { Authorization: `Bearer ${token}` },
      })
    );
    expect(listRes.status).toBe(200);
    const members = (await listRes.json()) as { userId: string; role: string }[];
    const rolesByUser = Object.fromEntries(members.map((row) => [row.userId, row.role]));
    expect(rolesByUser[seeded.userId]).toBe('OWNER');
    expect(rolesByUser[regBody.user.id]).toBe('MEMBER');
  });

  test('POST /api/auth/register duplicate email returns 409', async () => {
    const suffix = crypto.randomUUID();
    const email = `dup-${suffix}@integration.test`;
    const password = 'duppassword123';
    const body = JSON.stringify({ email, password });
    const r1 = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    );
    expect(r1.status).toBe(201);
    const r2 = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
    );
    expect(r2.status).toBe(409);
    const err = (await r2.json()) as { code: string };
    expect(err.code).toBe('email_taken');
  });

  test('POST /api/auth/register bad invite token returns 422 invite_invalid', async () => {
    const suffix = crypto.randomUUID();
    const res = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `badinv-${suffix}@integration.test`,
          password: 'longpassword12',
          householdInviteToken: 'nope'.padEnd(32, 'n'),
        }),
      })
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe('invite_invalid');
  });

  test('POST /api/auth/register invite email mismatch returns 422', async () => {
    const suffix = crypto.randomUUID();
    const plaintextToken = `y-${suffix}`.replace(/-/g, '').slice(0, 32).padEnd(32, '1');
    await prisma.householdInvitation.create({
      data: {
        householdId: seeded.householdId,
        email: `expected-${suffix}@integration.test`,
        tokenHash: hashInviteTokenPlaintext(plaintextToken),
        createdByUserId: seeded.userId,
        expiresAt: new Date(Date.now() + 48 * 3600 * 1000),
      },
    });
    const res = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `other-${suffix}@integration.test`,
          password: 'longpassword12',
          householdInviteToken: plaintextToken,
        }),
      })
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe('invite_email_mismatch');
  });

  test('POST /api/auth/register ambiguous body returns invalid_registration_body', async () => {
    const res = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `amb-${crypto.randomUUID()}@integration.test`,
          password: 'longpassword12',
          householdName: 'X',
          householdInviteToken: 'z'.repeat(32),
        }),
      })
    );
    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe('invalid_registration_body');
  });

  test('POST /api/auth/login success and failure share message', async () => {
    const suffix = crypto.randomUUID();
    const email = `login-${suffix}@integration.test`;
    const password = 'loginpass123';
    await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    const ok = await handler(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    expect(ok.status).toBe(200);

    const bad = await handler(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'wrongpassword123' }),
      })
    );
    expect(bad.status).toBe(401);
    const b1 = (await bad.json()) as { code: string; message: string };

    const unknown = await handler(
      new Request('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `nope-${suffix}@integration.test`,
          password: 'whateverlong1',
        }),
      })
    );
    expect(unknown.status).toBe(401);
    const b2 = (await unknown.json()) as { message: string };
    expect(b1.message).toBe(b2.message);
  });

  test('POST /api/auth/logout with Bearer returns 204', async () => {
    const suffix = crypto.randomUUID();
    const email = `out-${suffix}@integration.test`;
    const password = 'logoutpass123';
    const reg = await handler(
      new Request('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    );
    const { accessToken } = (await reg.json()) as { accessToken: string };
    const res = await handler(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(204);
  });

  test('GET /api/auth/register returns 405 Allow POST', async () => {
    const res = await handler(new Request('http://localhost/api/auth/register', { method: 'GET' }));
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('POST');
  });
});

describe('POST /api/auth/logout (development)', () => {
  const prevAuth = process.env.AUTH_MODE;
  let seeded: SeedHouseholdUserResult;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'development';
    seeded = await seedHouseholdUser();
  });

  afterAll(async () => {
    await teardownHouseholdUser(seeded);
    process.env.AUTH_MODE = prevAuth;
  });

  test('returns 204 with X-Dev-User-Id', async () => {
    const res = await handler(
      new Request('http://localhost/api/auth/logout', {
        method: 'POST',
        headers: {
          'X-Dev-User-Id': seeded.userId,
          'Content-Type': 'application/json',
        },
        body: '',
      })
    );
    expect(res.status).toBe(204);
  });
});
