/**
 * Normalizes an ingredient name for lookup / comparison: trim + lowercase only.
 */
export function normalizeIngredientName(input: string): string {
  return input.trim().toLowerCase();
}
