import { SignJWT, errors, jwtVerify } from 'jose';

/** Thrown when signing cannot run because `JWT_SECRET` (or related config) is missing or invalid. */
export class JwtAccessConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JwtAccessConfigError';
  }
}

/** Thrown when `JWT_SECRET` is missing (sign or verify). */
export class JwtAccessSecretMissingError extends JwtAccessConfigError {
  constructor() {
    super('JWT_SECRET is required');
    this.name = 'JwtAccessSecretMissingError';
  }
}

const EXPIRED_CODE = 'jwt_access_expired' as const;
const INVALID_SIGNATURE_CODE = 'jwt_access_invalid_signature' as const;
const INVALID_ALGORITHM_CODE = 'jwt_access_invalid_algorithm' as const;
const MALFORMED_CODE = 'jwt_access_malformed' as const;

/** Access token expired (`exp` in the past). Map to 401 + invalid_token. */
export class JwtAccessTokenExpiredError extends Error {
  readonly jwtAccessCode = EXPIRED_CODE;
  constructor(message = 'Access token expired', options?: ErrorOptions) {
    super(message, options);
    this.name = 'JwtAccessTokenExpiredError';
  }
}

/** Signature does not match (wrong secret, tampered payload, etc.). */
export class JwtAccessTokenInvalidSignatureError extends Error {
  readonly jwtAccessCode = INVALID_SIGNATURE_CODE;
  constructor(message = 'Access token signature invalid', options?: ErrorOptions) {
    super(message, options);
    this.name = 'JwtAccessTokenInvalidSignatureError';
  }
}

/** Token alg is not HS256 or not allowed for this verifier. */
export class JwtAccessTokenInvalidAlgorithmError extends Error {
  readonly jwtAccessCode = INVALID_ALGORITHM_CODE;
  constructor(message = 'Access token algorithm not allowed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'JwtAccessTokenInvalidAlgorithmError';
  }
}

/** Token cannot be parsed or required claims are missing/invalid. */
export class JwtAccessTokenMalformedError extends Error {
  readonly jwtAccessCode = MALFORMED_CODE;
  constructor(message = 'Access token malformed', options?: ErrorOptions) {
    super(message, options);
    this.name = 'JwtAccessTokenMalformedError';
  }
}

/** True when `e` is a JWT verify failure that should map to HTTP 401 `invalid_token`. */
export function isJwtAccessVerifyFailure(e: unknown): boolean {
  return (
    e instanceof JwtAccessTokenExpiredError ||
    e instanceof JwtAccessTokenInvalidSignatureError ||
    e instanceof JwtAccessTokenInvalidAlgorithmError ||
    e instanceof JwtAccessTokenMalformedError
  );
}

function requireSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw?.trim()) {
    throw new JwtAccessSecretMissingError();
  }
  return new TextEncoder().encode(raw);
}

function requireExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN;
  if (raw === undefined) {
    throw new JwtAccessConfigError('JWT_EXPIRES_IN is required (positive integer, seconds)');
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new JwtAccessConfigError('JWT_EXPIRES_IN is required (positive integer, seconds)');
  }
  if (!/^\d+$/.test(trimmed)) {
    throw new JwtAccessConfigError('JWT_EXPIRES_IN must be a positive integer (seconds)');
  }
  const n = Number(trimmed);
  if (!Number.isSafeInteger(n) || n <= 0) {
    throw new JwtAccessConfigError('JWT_EXPIRES_IN must be a positive integer (seconds)');
  }
  return n;
}

/**
 * Validates the same env vars used by `signAccessToken` / `verifyAccessToken`.
 * Call once at API process startup when production-style bearer JWT auth is in use
 * (`AUTH_MODE` not `development`) so missing config fails at deploy time instead of
 * on the first request or as an unhandled error from `resolveAuthUserId`.
 */
export function assertJwtAccessConfigLoaded(): void {
  requireSecret();
  requireExpiresInSeconds();
}

/** Minimum UTF-8 byte length for `JWT_SECRET` when using HS256 (operator guidance + startup checks). */
export const JWT_SECRET_MIN_UTF8_BYTES = 32;

function utf8ByteLength(s: string): number {
  return new TextEncoder().encode(s).length;
}

/**
 * Call only after `assertJwtAccessConfigLoaded()` so unset/empty secrets still fail as missing.
 * In production-style mode, too-short secrets fail startup with `JwtAccessConfigError`.
 */
export function assertJwtSecretMeetsMinUtf8LengthOrThrow(): void {
  const trimmed = process.env.JWT_SECRET?.trim() ?? '';
  if (!trimmed) {
    throw new JwtAccessSecretMissingError();
  }
  const bytes = utf8ByteLength(trimmed);
  if (bytes < JWT_SECRET_MIN_UTF8_BYTES) {
    throw new JwtAccessConfigError(
      `JWT_SECRET must be at least ${JWT_SECRET_MIN_UTF8_BYTES} UTF-8 bytes for HS256 (see README); got ${bytes}`
    );
  }
}

/**
 * Development-only hint: if `JWT_SECRET` is set but shorter than `JWT_SECRET_MIN_UTF8_BYTES`,
 * log one warning. Does nothing when unset or empty.
 */
export function warnIfDevelopmentJwtSecretBelowMin(): void {
  const trimmed = process.env.JWT_SECRET?.trim() ?? '';
  if (!trimmed) {
    return;
  }
  if (utf8ByteLength(trimmed) < JWT_SECRET_MIN_UTF8_BYTES) {
    console.warn(
      `[jwt-access] JWT_SECRET must be at least ${JWT_SECRET_MIN_UTF8_BYTES} UTF-8 bytes for HS256; use a cryptographically random value (see README)`
    );
  }
}

/**
 * Signs an HS256 access JWT with `sub`, `iat`, and `exp`.
 * Requires `JWT_SECRET` and `JWT_EXPIRES_IN` (seconds). Missing `JWT_SECRET` throws (never signs with an empty key).
 */
export async function signAccessToken(
  userId: string
): Promise<{ token: string; expiresIn: number }> {
  const sub = userId.trim();
  if (!sub) {
    throw new JwtAccessTokenMalformedError('Access token subject (userId) must be non-empty');
  }
  const secretKey = requireSecret();
  const expiresIn = requireExpiresInSeconds();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(now + expiresIn)
    .sign(secretKey);
  return { token, expiresIn };
}

function mapVerifyError(e: unknown): never {
  if (e instanceof errors.JWTExpired) {
    throw new JwtAccessTokenExpiredError(e.message, { cause: e });
  }
  if (e instanceof errors.JWSSignatureVerificationFailed) {
    throw new JwtAccessTokenInvalidSignatureError(e.message, { cause: e });
  }
  if (e instanceof errors.JOSEAlgNotAllowed) {
    throw new JwtAccessTokenInvalidAlgorithmError(e.message, { cause: e });
  }
  if (e instanceof errors.JWTInvalid || e instanceof errors.JWSInvalid) {
    throw new JwtAccessTokenMalformedError(e.message, { cause: e });
  }
  throw e;
}

/**
 * Verifies an HS256 access JWT and returns `sub`.
 * Wrong signature, wrong alg, expired, or malformed tokens throw distinguishable errors for HTTP mapping.
 */
export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  const secretKey = requireSecret();
  if (!token.trim()) {
    throw new JwtAccessTokenMalformedError('Token is empty');
  }
  try {
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub.trim()) {
      throw new JwtAccessTokenMalformedError('Access token missing sub claim');
    }
    return { sub };
  } catch (e) {
    mapVerifyError(e);
  }
}
