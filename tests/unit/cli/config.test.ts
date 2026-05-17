import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { loadConfig, saveToken, deleteTokenFile, TOKEN_FILE } from '../../../src/cli/config';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';

// Save and restore env vars so tests don't leak state
const envKeys = ['VMP_API_URL', 'VMP_TOKEN', 'VMP_DEV_USER_ID'];
const savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of envKeys) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(async () => {
  for (const key of envKeys) {
    if (savedEnv[key] !== undefined) {
      process.env[key] = savedEnv[key];
    } else {
      delete process.env[key];
    }
  }
  // Clean up any test token file
  try {
    await unlink(TOKEN_FILE);
  } catch {
    // ignore
  }
});

describe('loadConfig', () => {
  test('returns defaults when no env vars or token file', async () => {
    const config = await loadConfig();
    expect(config.baseUrl).toBe('http://localhost:3000');
    expect(config.headers['Authorization']).toBeUndefined();
    expect(config.headers['X-Dev-User-Id']).toBeUndefined();
  });

  test('uses VMP_API_URL env var for baseUrl', async () => {
    process.env.VMP_API_URL = 'https://api.example.com';
    const config = await loadConfig();
    expect(config.baseUrl).toBe('https://api.example.com');
  });

  test('cliBaseUrl overrides VMP_API_URL', async () => {
    process.env.VMP_API_URL = 'https://api.example.com';
    const config = await loadConfig('http://override:4000');
    expect(config.baseUrl).toBe('http://override:4000');
  });

  test('uses VMP_TOKEN env var for Authorization header', async () => {
    process.env.VMP_TOKEN = 'test-jwt-token';
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBe('Bearer test-jwt-token');
    expect(config.headers['X-Dev-User-Id']).toBeUndefined();
  });

  test('uses VMP_DEV_USER_ID when VMP_TOKEN is not set', async () => {
    process.env.VMP_DEV_USER_ID = 'user-uuid-123';
    const config = await loadConfig();
    expect(config.headers['X-Dev-User-Id']).toBe('user-uuid-123');
    expect(config.headers['Authorization']).toBeUndefined();
  });

  test('VMP_TOKEN takes precedence over VMP_DEV_USER_ID', async () => {
    process.env.VMP_TOKEN = 'my-token';
    process.env.VMP_DEV_USER_ID = 'user-uuid-123';
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBe('Bearer my-token');
    expect(config.headers['X-Dev-User-Id']).toBeUndefined();
  });

  test('reads token from ~/.vmp-token file when no env vars set', async () => {
    await writeFile(TOKEN_FILE, 'file-based-token', 'utf-8');
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBe('Bearer file-based-token');
  });

  test('VMP_TOKEN takes precedence over token file', async () => {
    await writeFile(TOKEN_FILE, 'file-based-token', 'utf-8');
    process.env.VMP_TOKEN = 'env-token';
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBe('Bearer env-token');
  });

  test('VMP_DEV_USER_ID takes precedence over token file', async () => {
    await writeFile(TOKEN_FILE, 'file-based-token', 'utf-8');
    process.env.VMP_DEV_USER_ID = 'dev-user-id';
    const config = await loadConfig();
    expect(config.headers['X-Dev-User-Id']).toBe('dev-user-id');
    expect(config.headers['Authorization']).toBeUndefined();
  });

  test('ignores whitespace-only VMP_TOKEN', async () => {
    process.env.VMP_TOKEN = '   ';
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBeUndefined();
  });

  test('ignores whitespace-only VMP_DEV_USER_ID', async () => {
    process.env.VMP_DEV_USER_ID = '   ';
    const config = await loadConfig();
    expect(config.headers['X-Dev-User-Id']).toBeUndefined();
  });

  test('ignores token file with only whitespace', async () => {
    await writeFile(TOKEN_FILE, '   \n', 'utf-8');
    const config = await loadConfig();
    expect(config.headers['Authorization']).toBeUndefined();
  });
});

describe('saveToken', () => {
  test('writes token to file', async () => {
    await saveToken('my-new-token');
    const content = await readFile(TOKEN_FILE, 'utf-8');
    expect(content).toBe('my-new-token');
  });

  test('overwrites existing token', async () => {
    await writeFile(TOKEN_FILE, 'old-token', 'utf-8');
    await saveToken('new-token');
    const content = await readFile(TOKEN_FILE, 'utf-8');
    expect(content).toBe('new-token');
  });
});

describe('deleteTokenFile', () => {
  test('removes the token file if it exists', async () => {
    await writeFile(TOKEN_FILE, 'to-delete', 'utf-8');
    expect(existsSync(TOKEN_FILE)).toBe(true);
    await deleteTokenFile();
    expect(existsSync(TOKEN_FILE)).toBe(false);
  });

  test('does nothing when token file does not exist', async () => {
    // Ensure file doesn't exist
    try {
      await unlink(TOKEN_FILE);
    } catch {
      // ignore
    }
    expect(existsSync(TOKEN_FILE)).toBe(false);
    // Should not throw
    await deleteTokenFile();
    expect(existsSync(TOKEN_FILE)).toBe(false);
  });
});
