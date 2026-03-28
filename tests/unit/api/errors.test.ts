import { describe, expect, test } from 'bun:test';
import { jsonError } from '../../../src/api/errors';

describe('jsonError', () => {
  test('returns JSON error with status, code, and message', async () => {
    const res = jsonError(404, 'no_eligible_meals', 'x');
    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')?.includes('application/json')).toBe(true);
    const body = (await res.json()) as { code: string; message?: string };
    expect(body.code).toBe('no_eligible_meals');
    expect(body.message).toBe('x');
  });
});
