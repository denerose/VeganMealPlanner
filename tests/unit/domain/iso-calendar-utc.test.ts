import { describe, expect, test } from 'bun:test';
import { formatDateAsIsoYmdUtc } from '../../../src/domain/lib/iso-calendar-utc';

describe('formatDateAsIsoYmdUtc', () => {
  test('formats UTC calendar components', () => {
    const d = new Date(Date.UTC(2026, 2, 15, 12, 0, 0, 0));
    expect(formatDateAsIsoYmdUtc(d)).toBe('2026-03-15');
  });
});
