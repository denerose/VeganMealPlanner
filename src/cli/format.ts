/**
 * Output formatting utilities for the CLI.
 * Default output is human-readable tables; `--json` emits raw JSON.
 */

export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format an array of objects as an aligned text table.
 *
 * @param headers - Column labels
 * @param rows    - Arrays of string cell values, one per row
 */
export function formatTable(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const maxDataLen = rows.reduce((max, row) => Math.max(max, (row[i] ?? '').length), 0);
    return Math.max(h.length, maxDataLen);
  });

  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i]!)).join('  ');
  const separator = colWidths.map((w) => '─'.repeat(w)).join('──');
  const dataLines = rows.map((row) =>
    row.map((cell, i) => (cell ?? '').padEnd(colWidths[i]!)).join('  ')
  );

  return [headerLine, separator, ...dataLines].join('\n');
}

/**
 * Format a single record as a key-value listing.
 */
export function formatRecord(pairs: [string, string][]): string {
  const labelWidth = pairs.reduce((max, [label]) => Math.max(max, label.length), 0);
  return pairs.map(([label, value]) => `${label.padEnd(labelWidth)}  ${value}`).join('\n');
}
