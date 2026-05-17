import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { ApiClient } from '../../../src/cli/client';

// Save env so tests don't leak
const envKeys = ['VMP_API_URL', 'VMP_TOKEN', 'VMP_DEV_USER_ID'];
const savedEnv: Record<string, string | undefined> = {};

let originalFetch: typeof globalThis.fetch;
let fetchCalls: Array<{ url: string; init: RequestInit }> = [];

beforeEach(() => {
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  originalFetch = globalThis.fetch;
  fetchCalls = [];
});

afterEach(() => {
  for (const key of envKeys) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
  globalThis.fetch = originalFetch;
});

function mockFetch(responseBody: string, status = 200): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    fetchCalls.push({ url, init: init ?? {} });
    return new Response(responseBody, { status });
  };
}

describe('ApiClient', () => {
  test('GET sends request with correct URL and method', async () => {
    mockFetch(JSON.stringify([{ id: '1', name: 'chickpeas' }]), 200);

    const api = new ApiClient();
    const data = await api.get<Array<{ id: string; name: string }>>('/api/ingredients');

    expect(data.length).toBe(1);
    expect(data[0]!.name).toBe('chickpeas');
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.url).toBe('http://localhost:3000/api/ingredients');
    expect(fetchCalls[0]!.init.method).toBe('GET');
  });

  test('POST sends body as JSON', async () => {
    mockFetch(JSON.stringify({ id: '2', name: 'tofu' }), 201);

    const api = new ApiClient();
    const data = await api.post<{ id: string; name: string }>('/api/ingredients', {
      name: 'tofu',
      storageType: 'REFRIGERATED',
    });

    expect(data.id).toBe('2');
    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.init.method).toBe('POST');
    expect(fetchCalls[0]!.init.body).toBe(
      JSON.stringify({ name: 'tofu', storageType: 'REFRIGERATED' })
    );
  });

  test('PATCH sends body as JSON', async () => {
    mockFetch(JSON.stringify({ id: '2', name: 'tempeh' }), 200);

    const api = new ApiClient();
    const data = await api.patch<{ id: string; name: string }>('/api/ingredients/2', {
      name: 'tempeh',
    });

    expect(data.name).toBe('tempeh');
    expect(fetchCalls[0]!.init.method).toBe('PATCH');
  });

  test('DELETE handles 204 No Content', async () => {
    mockFetch('', 204);

    const api = new ApiClient();
    await api.delete('/api/ingredients/2');

    expect(fetchCalls.length).toBe(1);
    expect(fetchCalls[0]!.init.method).toBe('DELETE');
  });

  test('throws ApiClientError on non-2xx response with JSON error body', async () => {
    mockFetch(JSON.stringify({ code: 'not_found', message: 'Ingredient not found' }), 404);

    const api = new ApiClient();
    try {
      await api.get('/api/ingredients/nonexistent');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const err = e as Error & { status: number; code: string };
      expect(err.status).toBe(404);
      expect(err.code).toBe('not_found');
      expect(err.message).toBe('Ingredient not found');
    }
  });

  test('throws ApiClientError with defaults when error body is not JSON', async () => {
    mockFetch('Internal Server Error', 500);

    const api = new ApiClient();
    try {
      await api.get('/api/broken');
      expect.unreachable('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      const err = e as Error & { status: number; code: string };
      expect(err.status).toBe(500);
      expect(err.code).toBe('unknown_error');
      expect(err.message).toBe('Request failed with status 500');
    }
  });

  test('attaches Bearer token from VMP_TOKEN env var', async () => {
    process.env.VMP_TOKEN = 'my-jwt';
    mockFetch('[]', 200);

    const api = new ApiClient();
    await api.get('/api/meals');

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-jwt');
  });

  test('attaches X-Dev-User-Id from VMP_DEV_USER_ID env var', async () => {
    process.env.VMP_DEV_USER_ID = 'user-123';
    mockFetch('[]', 200);

    const api = new ApiClient();
    await api.get('/api/meals');

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['X-Dev-User-Id']).toBe('user-123');
    expect(headers['Authorization']).toBeUndefined();
  });

  test('uses VMP_API_URL env var as base URL', async () => {
    process.env.VMP_API_URL = 'http://my-server:9000';
    mockFetch('[]', 200);

    const api = new ApiClient();
    await api.get('/api/health');

    expect(fetchCalls[0]!.url).toBe('http://my-server:9000/api/health');
  });

  test('does not send body or Content-Type for GET requests', async () => {
    mockFetch('[]', 200);

    const api = new ApiClient();
    await api.get('/api/meals');

    expect(fetchCalls[0]!.init.body).toBeUndefined();
    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  test('caches config across multiple requests', async () => {
    process.env.VMP_TOKEN = 'cached-token';
    mockFetch('[]', 200);

    const api = new ApiClient();
    await api.get('/api/meals');
    await api.get('/api/ingredients');

    const headers1 = fetchCalls[0]!.init.headers as Record<string, string>;
    const headers2 = fetchCalls[1]!.init.headers as Record<string, string>;
    expect(headers1['Authorization']).toBe('Bearer cached-token');
    expect(headers2['Authorization']).toBe('Bearer cached-token');
  });

  test('POST sends Content-Type application/json', async () => {
    mockFetch(JSON.stringify({ id: '2', name: 'tofu' }), 201);

    const api = new ApiClient();
    await api.post('/api/ingredients', { name: 'tofu' });

    const headers = fetchCalls[0]!.init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('DELETE throws on non-204 non-2xx response', async () => {
    mockFetch(
      JSON.stringify({ code: 'meal_in_use', message: 'Meal is referenced by a day plan' }),
      409
    );

    const api = new ApiClient();
    try {
      await api.delete('/api/meals/in-use');
      expect.unreachable('Should have thrown');
    } catch (e) {
      const err = e as Error & { status: number; code: string };
      expect(err.status).toBe(409);
      expect(err.code).toBe('meal_in_use');
    }
  });
});
