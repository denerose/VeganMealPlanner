import { ApiProblem } from '../api-problem';

/**
 * Runs a household-scoped lookup and throws a consistent 404 when the row is missing.
 *
 * @param label Human-readable resource name used in the 404 message (e.g. "Ingredient").
 * @param find Scoped query returning the row or null.
 */
export async function requireScoped<T>(label: string, find: () => Promise<T | null>): Promise<T> {
  const row = await find();
  if (!row) {
    throw new ApiProblem(404, 'not_found', `${label} not found`);
  }
  return row;
}
