import { homedir } from 'node:os';
import { chmod, readFile, unlink, writeFile } from 'node:fs/promises';

export const TOKEN_FILE = `${homedir()}/.vmp-token`;

export interface CliConfig {
  baseUrl: string;
  headers: Record<string, string>;
}

/**
 * Resolve CLI configuration from env vars and the persisted token file.
 *
 * Priority for the access token:
 *   1. `VMP_TOKEN` env var (always wins)
 *   2. `~/.vmp-token` file
 *
 * `VMP_DEV_USER_ID` sets `X-Dev-User-Id` for development-mode auth.
 */
export async function loadConfig(cliBaseUrl?: string): Promise<CliConfig> {
  const baseUrl = cliBaseUrl ?? process.env.VMP_API_URL ?? 'http://localhost:3000';
  const headers: Record<string, string> = {};

  const envToken = process.env.VMP_TOKEN?.trim();
  const devUserId = process.env.VMP_DEV_USER_ID?.trim();

  if (envToken) {
    headers['Authorization'] = `Bearer ${envToken}`;
  } else if (devUserId) {
    headers['X-Dev-User-Id'] = devUserId;
  } else {
    const fileToken = await readTokenFile();
    if (fileToken) {
      headers['Authorization'] = `Bearer ${fileToken}`;
    }
  }

  return { baseUrl, headers };
}

async function readTokenFile(): Promise<string | null> {
  try {
    const token = await readFile(TOKEN_FILE, 'utf-8');
    return token.trim() || null;
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  await writeFile(TOKEN_FILE, token, 'utf-8');
  await chmod(TOKEN_FILE, 0o600);
}

export async function deleteTokenFile(): Promise<void> {
  try {
    await unlink(TOKEN_FILE);
  } catch {
    // already gone — nothing to do
  }
}
