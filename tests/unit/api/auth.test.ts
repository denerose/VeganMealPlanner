import { afterEach, describe, expect, test } from 'bun:test';
import { resolveAuthUserId } from '../../../src/api/auth';
import { signAccessToken } from '../../../src/api/jwt-access';

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

  test('development accepts X-Dev-User-Id', async () => {
    process.env.AUTH_MODE = 'development';
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': id },
    });
    expect(await resolveAuthUserId(req)).toBe(id);
  });

  test('development missing header returns 401 Response', async () => {
    process.env.AUTH_MODE = 'development';
    const req = new Request('http://localhost/api/me');
    const out = await resolveAuthUserId(req);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
  });

  test('production rejects X-Dev-User-Id', async () => {
    process.env.AUTH_MODE = 'production';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': '550e8400-e29b-41d4-a716-446655440000' },
    });
    const out = await resolveAuthUserId(req);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
    expect(await (out as Response).json()).toEqual({
      code: 'dev_header_in_prod',
      message: 'X-Dev-User-Id is not allowed when AUTH_MODE is not development',
    });
  });

  test('production accepts signed bearer JWT', async () => {
    process.env.AUTH_MODE = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
    process.env.JWT_EXPIRES_IN = '3600';
    const sub = '550e8400-e29b-41d4-a716-446655440000';
    const { token } = await signAccessToken(sub);
    const req = new Request('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(await resolveAuthUserId(req)).toBe(sub);
  });

  test('production rejects unsigned legacy xx.payload.yy token with invalid_token', async () => {
    process.env.AUTH_MODE = 'production';
    process.env.JWT_SECRET = 'test-secret-at-least-32-chars-long!!';
    process.env.JWT_EXPIRES_IN = '3600';
    const sub = '550e8400-e29b-41d4-a716-446655440000';
    const payload = btoa(JSON.stringify({ sub }));
    const token = `xx.${payload}.yy`;
    const req = new Request('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const out = await resolveAuthUserId(req);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
    expect(await (out as Response).json()).toEqual({
      code: 'invalid_token',
      message: 'Invalid or expired access token',
    });
  });
});
