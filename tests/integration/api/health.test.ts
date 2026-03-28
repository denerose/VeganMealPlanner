import { describe, expect, test } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { createFetchHandler, type PrismaLike } from '../../../src/api/server';

function asPrismaClient(mock: PrismaLike): PrismaClient {
  return mock as unknown as PrismaClient;
}

describe('GET /api/health', () => {
  test("returns 200 and { status: 'ok' } when DB connects", async () => {
    const mockPrisma: PrismaLike = {
      $connect: () => Promise.resolve(),
    };
    const handler = createFetchHandler(asPrismaClient(mockPrisma));
    const res = await handler(new Request('http://localhost/api/health', { method: 'GET' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });

  test("returns 503 and { status: 'error' } when DB connection fails", async () => {
    const mockPrisma: PrismaLike = {
      $connect: () => Promise.reject(new Error('connection failed')),
    };
    const handler = createFetchHandler(asPrismaClient(mockPrisma));
    const res = await handler(new Request('http://localhost/api/health', { method: 'GET' }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: 'error' });
  });

  test('response has JSON body with status field', async () => {
    const mockPrisma: PrismaLike = { $connect: () => Promise.resolve() };
    const handler = createFetchHandler(asPrismaClient(mockPrisma));
    const res = await handler(new Request('http://localhost/api/health', { method: 'GET' }));
    const body = (await res.json()) as { status: string };
    expect(body).toHaveProperty('status');
    expect(typeof body.status).toBe('string');
  });
});

describe('other paths', () => {
  test('returns 401 for unknown api path without auth', async () => {
    const prev = process.env.AUTH_MODE;
    process.env.AUTH_MODE = 'production';
    const mockPrisma: PrismaLike = { $connect: () => Promise.resolve() };
    const handler = createFetchHandler(asPrismaClient(mockPrisma));
    const res = await handler(new Request('http://localhost/api/other', { method: 'GET' }));
    expect(res.status).toBe(401);
    process.env.AUTH_MODE = prev;
  });

  test('returns 401 for root path without auth', async () => {
    const prev = process.env.AUTH_MODE;
    process.env.AUTH_MODE = 'production';
    const mockPrisma: PrismaLike = { $connect: () => Promise.resolve() };
    const handler = createFetchHandler(asPrismaClient(mockPrisma));
    const res = await handler(new Request('http://localhost/', { method: 'GET' }));
    expect(res.status).toBe(401);
    process.env.AUTH_MODE = prev;
  });
});
