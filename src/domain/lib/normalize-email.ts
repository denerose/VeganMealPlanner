/**
 * Normalizes an email for auth (lookup / comparison): trim + lowercase only.
 */
export function normalizeEmail(s: string): string {
  return s.trim().toLowerCase();
}
