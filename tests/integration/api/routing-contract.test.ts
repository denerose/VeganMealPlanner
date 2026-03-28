import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { prisma } from '../../../src/lib/prisma';
import { createFetchHandler } from '../../../src/api/server';
import { seedHouseholdUser, teardownHouseholdUser } from './helpers';

const handler = createFetchHandler(prisma);

describe('routing contract (integration)', () => {
  const prevAuth = process.env.AUTH_MODE;
  let seeded: Awaited<ReturnType<typeof seedHouseholdUser>>;

  beforeAll(async () => {
    process.env.AUTH_MODE = 'development';
    seeded = await seedHouseholdUser();
  });

  afterAll(async () => {
    process.env.AUTH_MODE = prevAuth;
    await teardownHouseholdUser(seeded);
  });

  test('undocumented /api/* returns 404 with empty body when authenticated', async () => {
    const res = await handler(
      new Request('http://localhost/api/this-path-is-not-documented', {
        method: 'GET',
        headers: { 'X-Dev-User-Id': seeded.userId },
      })
    );
    expect(res.status).toBe(404);
    expect((await res.text()).length).toBe(0);
  });

  test('wrong method on documented /api/me returns 405 with Allow GET, PATCH', async () => {
    const res = await handler(
      new Request('http://localhost/api/me', {
        method: 'DELETE',
        headers: { 'X-Dev-User-Id': seeded.userId },
      })
    );
    expect(res.status).toBe(405);
    const allow = res.headers.get('Allow');
    expect(allow).toBeTruthy();
    const methods = new Set(
      allow!
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    );
    expect(methods.has('GET')).toBe(true);
    expect(methods.has('PATCH')).toBe(true);
  });
});
