/**
 * Normalizes an email for auth (lookup / comparison): trim + lowercase only.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
