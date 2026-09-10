import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import SwaggerParser from '@apidevtools/swagger-parser';
import { apiAllowedMethodsForPathname, documentedApiRoutes } from '../../../src/api/router';

const specPath = join(import.meta.dir, '../../../contracts/openapi.yaml');

const HTTP_METHOD_KEYS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function specRouteEntries(api: Awaited<ReturnType<typeof SwaggerParser.validate>>): Set<string> {
  const entries = new Set<string>();
  for (const [path, pathItem] of Object.entries(api.paths ?? {})) {
    if (!path.startsWith('/api/')) continue;
    for (const key of HTTP_METHOD_KEYS) {
      if (pathItem && key in pathItem) {
        entries.add(`${path} ${key.toUpperCase()}`);
      }
    }
  }
  return entries;
}

function routerRouteEntries(): Set<string> {
  const entries = new Set<string>();
  for (const route of documentedApiRoutes()) {
    for (const method of route.methods) {
      entries.add(`${route.path} ${method}`);
    }
  }
  return entries;
}

describe('router ↔ openapi.yaml parity', () => {
  test('router table documents exactly the paths and methods in the contract', async () => {
    const api = await SwaggerParser.validate(specPath);
    expect([...routerRouteEntries()].sort()).toEqual([...specRouteEntries(api)].sort());
  });

  test('router patterns use OpenAPI parameter names', async () => {
    const api = await SwaggerParser.validate(specPath);
    const specPaths = new Set(Object.keys(api.paths ?? {}));
    for (const route of documentedApiRoutes()) {
      expect(specPaths.has(route.path)).toBe(true);
    }
  });

  test('apiAllowedMethodsForPathname is derived from the table', () => {
    expect(apiAllowedMethodsForPathname('/api/me')).toEqual(['GET', 'PATCH']);
    expect(apiAllowedMethodsForPathname('/api/meals/random')).toEqual(['GET']);
    expect(apiAllowedMethodsForPathname('/api/ingredients/not-a-uuid')).toBeNull();
    expect(apiAllowedMethodsForPathname('/api/not/documented')).toBeNull();
    // trailing slashes are tolerated, matching dispatch behavior
    expect(apiAllowedMethodsForPathname('/api/meals/')).toEqual(['GET', 'POST']);
  });
});
