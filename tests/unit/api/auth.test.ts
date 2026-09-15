import { afterEach, describe, expect, test } from 'bun:test';
import type { PrismaClient } from '@prisma/client';
import { resolveAuthUserId } from '../../../src/api/auth';
import { signAccessToken, verifyAccessToken } from '../../../src/api/jwt-access';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';

/** A prisma stand-in whose every property access throws — proves a code path never touches the DB. */
function unreachablePrisma(): PrismaClient {
  return new Proxy(
    {},
    {
      get() {
        throw new Error('prisma must not be accessed on this code path');
      },
    }
  ) as unknown as PrismaClient;
}

/** Minimal prisma mock that answers `user.findUnique` with the given `tokensValidAfter` epoch. */
function prismaWithEpoch(tokensValidAfter: Date | null): PrismaClient {
  return {
    user: {
      findUnique: async () => (tokensValidAfter === null ? null : { tokensValidAfter }),
    },
  } as unknown as PrismaClient;
}

describe('resolveAuthUserId', () => {
  const prevMode = process.env.AUTH_MODE;
  const prevSecret = process.env.JWT_SECRET;
  const prevExpires = process.env.JWT_EXPIRES_IN;

  afterEach(() => {
    process.env.AUTH_MODE = prevMode;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
    if (prevExpires === undefined) delete process.env.JWT_EXPIRES_IN;
    else process.env.JWT_EXPIRES_IN = prevExpires;
  });

  function setProductionJwtEnv() {
    process.env.AUTH_MODE = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
    process.env.JWT_EXPIRES_IN = '3600';
  }

  function bearerRequest(token: string): Request {
    return new Request('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  test('development accepts X-Dev-User-Id without touching prisma', async () => {
    process.env.AUTH_MODE = 'development';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': USER_ID },
    });
    expect(await resolveAuthUserId(req, unreachablePrisma())).toBe(USER_ID);
  });

  test('development missing header returns 401 Response', async () => {
    process.env.AUTH_MODE = 'development';
    const req = new Request('http://localhost/api/me');
    const out = await resolveAuthUserId(req, unreachablePrisma());
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
  });

  test('production rejects X-Dev-User-Id', async () => {
    process.env.AUTH_MODE = 'production';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': USER_ID },
    });
    const out = await resolveAuthUserId(req, unreachablePrisma());
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
    expect(await (out as Response).json()).toEqual({
      code: 'dev_header_in_prod',
      message: 'X-Dev-User-Id is not allowed when AUTH_MODE is not development',
    });
  });

  test('production accepts signed bearer JWT issued after the revocation epoch', async () => {
    setProductionJwtEnv();
    const { token } = await signAccessToken(USER_ID);
    // Epoch far in the past (the 1970 default): any token we just signed passes.
    const out = await resolveAuthUserId(bearerRequest(token), prismaWithEpoch(new Date(0)));
    expect(out).toBe(USER_ID);
  });

  test('production accepts bearer JWT whose iat equals the epoch second', async () => {
    setProductionJwtEnv();
    const { token } = await signAccessToken(USER_ID);
    const { iat } = await verifyAccessToken(token);
    // Same wall-clock second as a logout: the token must still pass.
    const out = await resolveAuthUserId(
      bearerRequest(token),
      prismaWithEpoch(new Date(iat * 1000))
    );
    expect(out).toBe(USER_ID);
  });

  test('production rejects bearer JWT whose iat predates tokensValidAfter', async () => {
    setProductionJwtEnv();
    const { token } = await signAccessToken(USER_ID);
    // Epoch in the future: every outstanding token predates it.
    const out = await resolveAuthUserId(
      bearerRequest(token),
      prismaWithEpoch(new Date(Date.now() + 60_000))
    );
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
    expect(await (out as Response).json()).toEqual({
      code: 'invalid_token',
      message: 'Invalid or expired access token',
    });
  });

  test('production rejects bearer JWT for a deleted user with generic invalid_token', async () => {
    setProductionJwtEnv();
    const { token } = await signAccessToken(USER_ID);
    const out = await resolveAuthUserId(bearerRequest(token), prismaWithEpoch(null));
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
    expect(await (out as Response).json()).toEqual({
      code: 'invalid_token',
      message: 'Invalid or expired access token',
    });
  });

  test('production rejects unsigned legacy xx.payload.yy token with invalid_token', async () => {
    setProductionJwtEnv();
    const payload = btoa(JSON.stringify({ sub: USER_ID }));
    const token = `xx.${payload}.yy`;
    const out = await resolveAuthUserId(bearerRequest(token), prismaWithEpoch(new Date(0)));
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
    expect(await (out as Response).json()).toEqual({
      code: 'invalid_token',
      message: 'Invalid or expired access token',
    });
  });
});
