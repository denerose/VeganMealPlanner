import { describe, expect, test } from 'bun:test';
import { planDateFromYmd } from '../../../src/domain/lib/plan-date';

describe('planDateFromYmd', () => {
  test('parses YYYY-MM-DD to Date at UTC noon', () => {
    const d = planDateFromYmd('2026-03-15');
    expect(d.toISOString()).toBe('2026-03-15T12:00:00.000Z');
  });

  test('throws on invalid format', () => {
    expect(() => planDateFromYmd('03-15-2026')).toThrow(RangeError);
    expect(() => planDateFromYmd('2026-3-15')).toThrow(RangeError);
    expect(() => planDateFromYmd('')).toThrow(RangeError);
  });
});
