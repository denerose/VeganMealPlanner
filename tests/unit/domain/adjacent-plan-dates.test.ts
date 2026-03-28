import { describe, expect, test } from 'bun:test';
import { nextPlanYmd, previousPlanYmd } from '../../../src/domain/lib/adjacent-plan-dates';

describe('adjacent-plan-dates', () => {
  test('previous and next around 2026-03-15', () => {
    expect(previousPlanYmd('2026-03-15')).toBe('2026-03-14');
    expect(nextPlanYmd('2026-03-15')).toBe('2026-03-16');
  });

  test('previous crosses year boundary', () => {
    expect(previousPlanYmd('2026-01-01')).toBe('2025-12-31');
  });
});
