import { describe, expect, test } from 'bun:test';
import { normalizeEmail } from '../../../src/domain/lib/normalize-email';

/**
 * Empty-after-trim convention: normalizeEmail returns '' for '' and whitespace-only
 * strings (no throw). Callers that require a non-empty email should validate separately.
 */
describe('normalizeEmail', () => {
  test('trims and lowercases for auth comparison', () => {
    expect(normalizeEmail('  A@B.COM ')).toBe('a@b.com');
  });

  test('stable for already-normal addresses', () => {
    expect(normalizeEmail('user@example.com')).toBe('user@example.com');
  });

  test('empty string returns empty string', () => {
    expect(normalizeEmail('')).toBe('');
  });

  test('whitespace-only returns empty string', () => {
    expect(normalizeEmail('   \t  ')).toBe('');
  });
});
