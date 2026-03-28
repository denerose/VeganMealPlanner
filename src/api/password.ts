import { hash, verify } from '@node-rs/argon2';

// Argon2id — @node-rs/argon2 `Algorithm` const enum is not importable with verbatimModuleSyntax.
const ARGON2ID = { algorithm: 2 } as const;

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2ID);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return verify(hashed, plain);
}
