import { afterEach, describe, expect, test } from 'bun:test';
import { decodeJwtSub, resolveAuthUserId } from '../../../src/api/auth';

describe('resolveAuthUserId', () => {
  const prevMode = process.env.AUTH_MODE;

  afterEach(() => {
    process.env.AUTH_MODE = prevMode;
  });

  test('development accepts X-Dev-User-Id', () => {
    process.env.AUTH_MODE = 'development';
    const id = '550e8400-e29b-41d4-a716-446655440000';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': id },
    });
    expect(resolveAuthUserId(req)).toBe(id);
  });

  test('development missing header returns 401 Response', () => {
    process.env.AUTH_MODE = 'development';
    const req = new Request('http://localhost/api/me');
    const out = resolveAuthUserId(req);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(401);
  });

  test('production rejects X-Dev-User-Id', () => {
    process.env.AUTH_MODE = 'production';
    const req = new Request('http://localhost/api/me', {
      headers: { 'X-Dev-User-Id': '550e8400-e29b-41d4-a716-446655440000' },
    });
    const out = resolveAuthUserId(req);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
  });

  test('production decodes JWT sub', () => {
    process.env.AUTH_MODE = 'production';
    const sub = '550e8400-e29b-41d4-a716-446655440000';
    const payload = btoa(JSON.stringify({ sub }));
    const token = `xx.${payload}.yy`;
    const req = new Request('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(resolveAuthUserId(req)).toBe(sub);
  });
});

describe('decodeJwtSub', () => {
  test('returns null for malformed token', () => {
    expect(decodeJwtSub('not-a-jwt')).toBeNull();
  });
});
