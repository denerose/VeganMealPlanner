import { describe, expect, test } from 'bun:test';
import {
  formatJson,
  formatDate,
  formatDateTime,
  formatTable,
  formatRecord,
} from '../../../src/cli/format';

describe('formatJson', () => {
  test('pretty-prints JSON with 2-space indent', () => {
    const result = formatJson({ name: 'tofu scramble', id: 42 });
    expect(result).toBe('{\n  "name": "tofu scramble",\n  "id": 42\n}');
  });

  test('handles arrays', () => {
    const result = formatJson([1, 2, 3]);
    expect(result).toBe('[\n  1,\n  2,\n  3\n]');
  });

  test('handles null', () => {
    expect(formatJson(null)).toBe('null');
  });

  test('handles strings', () => {
    expect(formatJson('hello')).toBe('"hello"');
  });
});

describe('formatDate', () => {
  test('formats an ISO date string', () => {
    const result = formatDate('2026-05-17T12:00:00.000Z');
    // Locale output varies, but should contain the year and month
    expect(result).toContain('2026');
    expect(result).toContain('May');
  });

  test('returns the input unchanged for invalid dates', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  test('returns the input for empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

describe('formatDateTime', () => {
  test('formats an ISO datetime with time component', () => {
    const result = formatDateTime('2026-05-17T14:30:00.000Z');
    expect(result).toContain('2026');
    expect(result).toContain('May');
  });

  test('returns the input unchanged for invalid dates', () => {
    expect(formatDateTime('garbage')).toBe('garbage');
  });
});

describe('formatTable', () => {
  test('formats headers and rows as aligned text table', () => {
    const result = formatTable(
      ['ID', 'Name'],
      [
        ['1', 'chickpeas'],
        ['2', 'tofu'],
      ]
    );
    const lines = result.split('\n');
    expect(lines.length).toBe(4); // header + separator + 2 data rows
    // Header line
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Name');
    // Separator
    expect(lines[1]).toContain('─');
    // Data rows
    expect(lines[2]).toContain('chickpeas');
    expect(lines[3]).toContain('tofu');
  });

  test('handles empty rows', () => {
    const result = formatTable(['A', 'B'], []);
    const lines = result.split('\n');
    expect(lines.length).toBe(2); // header + separator, no data
  });

  test('pads columns to the widest cell', () => {
    const result = formatTable(['Short', 'X'], [['abcde', 'z']]);
    const lines = result.split('\n');
    // "Short" is 5 chars, "abcde" is 5 chars → col 0 width = 5
    // "X" is 1 char, "z" is 1 char → col 1 width = 1
    expect(lines[0]!).toBe('Short  X');
    expect(lines[2]!).toBe('abcde  z');
  });

  test('handles rows with missing cells (undefined)', () => {
    const result = formatTable(['A', 'B'], [['only-a']]);
    const lines = result.split('\n');
    // Second column should be empty-padded
    expect(lines[2]).toBeDefined();
    expect(lines[2]!.includes('only-a')).toBe(true);
  });
});

describe('formatRecord', () => {
  test('formats key-value pairs with aligned labels', () => {
    const result = formatRecord([
      ['Name', 'red lentils'],
      ['Storage Type', 'PANTRY'],
    ]);
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    // "Storage Type" is the longest label (12 chars)
    expect(lines[0]).toBe('Name          red lentils');
    expect(lines[1]).toBe('Storage Type  PANTRY');
  });

  test('handles empty pairs', () => {
    const result = formatRecord([]);
    expect(result).toBe('');
  });

  test('handles single pair', () => {
    const result = formatRecord([['Key', 'Value']]);
    expect(result).toBe('Key  Value');
  });
});
