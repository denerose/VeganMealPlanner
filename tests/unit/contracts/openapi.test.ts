import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

const specPath = join(import.meta.dir, '../../../contracts/openapi.yaml');

/** Keep in sync with `paths` keys under `/api/*` in contracts/openapi.yaml. */
const DOCUMENTED_API_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/register',
  '/api/day-plans',
  '/api/day-plans/bulk',
  '/api/day-plans/{dayPlanId}',
  '/api/health',
  '/api/household',
  '/api/household/invitations',
  '/api/household/members',
  '/api/ingredients',
  '/api/ingredients/{ingredientId}',
  '/api/me',
  '/api/meals',
  '/api/meals/random',
  '/api/meals/{mealId}',
] as const;

describe('contracts/openapi.yaml', () => {
  test('validates as OpenAPI 3.x', async () => {
    await expect(SwaggerParser.validate(specPath)).resolves.toBeDefined();
  });

  test('documents GET /api/health', async () => {
    const api = await SwaggerParser.validate(specPath);
    expect(api.paths?.['/api/health']?.get).toBeDefined();
  });

  test('documents every /api/* path (update list when OpenAPI gains paths)', async () => {
    const api = await SwaggerParser.validate(specPath);
    const paths = api.paths ?? {};
    const fromSpec = Object.keys(paths)
      .filter((p) => p.startsWith('/api/'))
      .sort();
    expect(fromSpec).toEqual([...DOCUMENTED_API_PATHS]);
  });
});
