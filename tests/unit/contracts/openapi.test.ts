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
});
