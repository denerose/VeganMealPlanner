import { describe, expect, test } from 'bun:test';
import { normalizeIngredientName } from '../../../src/domain/lib/normalize-ingredient-name';

describe('normalizeIngredientName', () => {
  test('trims and lowercases', () => {
    expect(normalizeIngredientName('  Tofu  ')).toBe('tofu');
  });
});
