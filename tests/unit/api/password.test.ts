import { describe, expect, test } from 'bun:test';
import { hashPassword, verifyPassword } from '../../../src/api/password';

describe('password', () => {
  const correct = 'correct-horse-battery-staple';

  test('hash then verify accepts correct password', async () => {
    const hashed = await hashPassword(correct);
    expect(hashed.length).toBeGreaterThan(0);
    expect(await verifyPassword(correct, hashed)).toBe(true);
  });

  test('verify rejects wrong password', async () => {
    const hashed = await hashPassword(correct);
    expect(await verifyPassword('wrong-password-here', hashed)).toBe(false);
  });

  test('encoded hash uses OWASP-aligned Argon2id parameters (m=19456, t=2, p=1)', async () => {
    const hashed = await hashPassword(correct);
    expect(hashed).toMatch(/\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  });
});
