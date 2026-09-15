import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import { requireScoped } from '../../../src/api/services/require-scoped';

describe('requireScoped', () => {
  it('returns the row when the scoped lookup finds one', async () => {
    const row = { id: 'ing-1', name: 'Tofu' };
    await expect(requireScoped('Ingredient', async () => row)).resolves.toBe(row);
  });

  it('throws 404 not_found with the label message when missing', async () => {
    let error: unknown;
    try {
      await requireScoped('Day plan', async () => null);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ApiProblem);
    const p = error as ApiProblem;
    expect(p.status).toBe(404);
    expect(p.code).toBe('not_found');
    expect(p.message).toBe('Day plan not found');
  });
});
