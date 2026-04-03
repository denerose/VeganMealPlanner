import { hash, verify } from '@node-rs/argon2';

// Argon2id — @node-rs/argon2 `Algorithm` const enum is not importable with verbatimModuleSyntax.
const ARGON2ID = { algorithm: 2 } as const;

/**
 * Argon2id cost parameters aligned with OWASP Password Storage Cheat Sheet (minimum
 * recommendation when using less than 64 GiB RAM): 19 MiB memory, 2 iterations, parallelism 1.
 *
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 *
 * `memoryCost` is in KiB (19 × 1024 = 19456).
 */
export const ARGON2_PASSWORD_OPTIONS = {
  ...ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_PASSWORD_OPTIONS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return verify(hashed, plain);
}
