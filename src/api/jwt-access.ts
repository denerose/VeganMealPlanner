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

function requireSecret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw?.trim()) {
    throw new JwtAccessSecretMissingError();
  }
  return new TextEncoder().encode(raw);
}

function requireExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN;
  if (raw === undefined || raw === '') {
    throw new JwtAccessConfigError('JWT_EXPIRES_IN is required (positive integer, seconds)');
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
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

/**
 * Signs an HS256 access JWT with `sub`, `iat`, and `exp`.
 * Requires `JWT_SECRET` and `JWT_EXPIRES_IN` (seconds). Missing `JWT_SECRET` throws (never signs with an empty key).
 */
export async function signAccessToken(
  userId: string
): Promise<{ token: string; expiresIn: number }> {
  const secretKey = requireSecret();
  const expiresIn = requireExpiresInSeconds();
  const now = Math.floor(Date.now() / 1000);
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
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
