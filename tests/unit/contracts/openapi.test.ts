import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';

const specPath = join(import.meta.dir, '../../../contracts/openapi.yaml');

describe('contracts/openapi.yaml', () => {
  test('validates as OpenAPI 3.x', async () => {
    await expect(SwaggerParser.validate(specPath)).resolves.toBeDefined();
  });

  test('documents GET /api/health', async () => {
    const api = await SwaggerParser.validate(specPath);
    expect(api.paths?.['/api/health']?.get).toBeDefined();
  });

  test('documents core REST paths', async () => {
    const api = await SwaggerParser.validate(specPath);
    const paths = api.paths ?? {};
    expect(paths['/api/me']?.get).toBeDefined();
    expect(paths['/api/auth/register']?.post).toBeDefined();
    expect(paths['/api/auth/login']?.post).toBeDefined();
    expect(paths['/api/auth/logout']?.post).toBeDefined();
    expect(paths['/api/household/invitations']?.post).toBeDefined();
    expect(paths['/api/meals']?.get).toBeDefined();
    expect(paths['/api/meals/random']?.get).toBeDefined();
    expect(paths['/api/day-plans']?.get).toBeDefined();
    expect(paths['/api/day-plans/bulk']?.post).toBeDefined();
  });
});
