import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { SignJWT } from 'jose';
import {
  assertJwtAccessConfigLoaded,
  isJwtAccessVerifyFailure,
  JwtAccessConfigError,
  JwtAccessSecretMissingError,
  JwtAccessTokenExpiredError,
  JwtAccessTokenInvalidAlgorithmError,
  JwtAccessTokenInvalidSignatureError,
  JwtAccessTokenMalformedError,
  signAccessToken,
  verifyAccessToken,
} from '../../../src/api/jwt-access';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const SECRET_A = 'unit-test-jwt-secret-a-min-32-chars!!';
const SECRET_B = 'unit-test-jwt-secret-b-min-32-chars!!';

describe('jwt-access', () => {
  const envKeys = ['JWT_SECRET', 'JWT_EXPIRES_IN', 'NODE_ENV'] as const;
  let previous: Partial<Record<(typeof envKeys)[number], string | undefined>>;

  beforeEach(() => {
    previous = {};
    for (const k of envKeys) {
      previous[k] = process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      const v = previous[k];
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    }
  });

  function setJwtEnv(secret: string, expiresIn: string, nodeEnv?: string) {
    process.env.JWT_SECRET = secret;
    process.env.JWT_EXPIRES_IN = expiresIn;
    if (nodeEnv !== undefined) {
      process.env.NODE_ENV = nodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  }

  test('sign then verify returns same sub', async () => {
    setJwtEnv(SECRET_A, '3600');
    const { token, expiresIn } = await signAccessToken(USER_ID);
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
    expect(expiresIn).toBe(3600);
    const { sub } = await verifyAccessToken(token);
    expect(sub).toBe(USER_ID);
  });

  test('wrong secret fails verification with invalid signature error', async () => {
    setJwtEnv(SECRET_A, '3600');
    const { token } = await signAccessToken(USER_ID);
    setJwtEnv(SECRET_B, '3600');
    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(
      JwtAccessTokenInvalidSignatureError
    );
  });

  test('tampered payload fails verification with invalid signature error', async () => {
    setJwtEnv(SECRET_A, '3600');
    const { token } = await signAccessToken(USER_ID);
    const parts = token.split('.');
    expect(parts.length).toBe(3);
    const payload = parts[1]!;
    const tampered =
      payload.slice(0, -4) + (payload.at(-4) === 'A' ? 'B' : 'A') + payload.slice(-3);
    const badToken = `${parts[0]}.${tampered}.${parts[2]}`;
    await expect(verifyAccessToken(badToken)).rejects.toBeInstanceOf(
      JwtAccessTokenInvalidSignatureError
    );
  });

  test('expired token fails with expired error', async () => {
    setJwtEnv(SECRET_A, '3600');
    const key = new TextEncoder().encode(SECRET_A);
    const now = Math.floor(Date.now() / 1000);
    const expiredToken = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(key);
    await expect(verifyAccessToken(expiredToken)).rejects.toBeInstanceOf(
      JwtAccessTokenExpiredError
    );
  });

  test('token signed with HS512 is rejected (wrong algorithm)', async () => {
    setJwtEnv(SECRET_A, '3600');
    const key = new TextEncoder().encode(SECRET_A);
    const now = Math.floor(Date.now() / 1000);
    const hs512Token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(USER_ID)
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(key);
    await expect(verifyAccessToken(hs512Token)).rejects.toBeInstanceOf(
      JwtAccessTokenInvalidAlgorithmError
    );
  });

  test('sign without JWT_SECRET throws JwtAccessSecretMissingError', async () => {
    setJwtEnv(SECRET_A, '3600');
    delete process.env.JWT_SECRET;
    await expect(signAccessToken(USER_ID)).rejects.toBeInstanceOf(JwtAccessSecretMissingError);
  });

  test('verify without JWT_SECRET throws JwtAccessSecretMissingError', async () => {
    setJwtEnv(SECRET_A, '3600');
    const { token } = await signAccessToken(USER_ID);
    delete process.env.JWT_SECRET;
    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(JwtAccessSecretMissingError);
  });

  test('sign without JWT_SECRET throws even when NODE_ENV is production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '3600';
    await expect(signAccessToken(USER_ID)).rejects.toBeInstanceOf(JwtAccessSecretMissingError);
  });

  test('missing JWT_EXPIRES_IN throws JwtAccessConfigError', async () => {
    setJwtEnv(SECRET_A, '3600');
    delete process.env.JWT_EXPIRES_IN;
    await expect(signAccessToken(USER_ID)).rejects.toBeInstanceOf(JwtAccessConfigError);
  });

  test('JWT_EXPIRES_IN with non-numeric suffix throws JwtAccessConfigError', async () => {
    setJwtEnv(SECRET_A, '3600abc');
    await expect(signAccessToken(USER_ID)).rejects.toBeInstanceOf(JwtAccessConfigError);
  });

  test('JWT_EXPIRES_IN trimmed whitespace still parses', async () => {
    setJwtEnv(SECRET_A, ' 3600 ');
    const { token, expiresIn } = await signAccessToken(USER_ID);
    expect(expiresIn).toBe(3600);
    const { sub } = await verifyAccessToken(token);
    expect(sub).toBe(USER_ID);
  });

  test('JWT_EXPIRES_IN whitespace-only throws JwtAccessConfigError', async () => {
    setJwtEnv(SECRET_A, '   ');
    await expect(signAccessToken(USER_ID)).rejects.toBeInstanceOf(JwtAccessConfigError);
  });

  test('signAccessToken rejects empty userId', async () => {
    setJwtEnv(SECRET_A, '3600');
    await expect(signAccessToken('')).rejects.toBeInstanceOf(JwtAccessTokenMalformedError);
  });

  test('signAccessToken rejects whitespace-only userId', async () => {
    setJwtEnv(SECRET_A, '3600');
    await expect(signAccessToken('   ')).rejects.toBeInstanceOf(JwtAccessTokenMalformedError);
  });

  test('empty token is malformed', async () => {
    setJwtEnv(SECRET_A, '3600');
    await expect(verifyAccessToken('   ')).rejects.toBeInstanceOf(JwtAccessTokenMalformedError);
  });

  test('assertJwtAccessConfigLoaded passes when env is valid', () => {
    setJwtEnv(SECRET_A, '3600');
    expect(() => assertJwtAccessConfigLoaded()).not.toThrow();
  });

  test('assertJwtAccessConfigLoaded throws when JWT_SECRET missing', () => {
    delete process.env.JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '3600';
    expect(() => assertJwtAccessConfigLoaded()).toThrow(JwtAccessSecretMissingError);
  });

  test('assertJwtAccessConfigLoaded throws when JWT_EXPIRES_IN missing', () => {
    process.env.JWT_SECRET = SECRET_A;
    delete process.env.JWT_EXPIRES_IN;
    expect(() => assertJwtAccessConfigLoaded()).toThrow(JwtAccessConfigError);
  });

  test('isJwtAccessVerifyFailure is true for verify failure error classes', () => {
    expect(isJwtAccessVerifyFailure(new JwtAccessTokenExpiredError())).toBe(true);
    expect(isJwtAccessVerifyFailure(new JwtAccessTokenInvalidSignatureError())).toBe(true);
    expect(isJwtAccessVerifyFailure(new JwtAccessTokenInvalidAlgorithmError())).toBe(true);
    expect(isJwtAccessVerifyFailure(new JwtAccessTokenMalformedError())).toBe(true);
  });

  test('isJwtAccessVerifyFailure is false for other errors', () => {
    expect(isJwtAccessVerifyFailure(new Error('other'))).toBe(false);
    expect(isJwtAccessVerifyFailure(new JwtAccessSecretMissingError())).toBe(false);
    expect(isJwtAccessVerifyFailure(new JwtAccessConfigError('x'))).toBe(false);
    expect(isJwtAccessVerifyFailure(null)).toBe(false);
    expect(isJwtAccessVerifyFailure(undefined)).toBe(false);
  });
});
