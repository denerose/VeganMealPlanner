import { loadConfig, type CliConfig } from './config';

export class ApiClientError extends Error {
  override readonly message: string;
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.message = message;
  }
}

export class ApiClient {
  private config!: CliConfig;
  private loaded = false;

  /** Force the client to reload config on the next request. */
  reset(): void {
    this.loaded = false;
  }

  private async ensureConfig(): Promise<void> {
    if (!this.loaded) {
      this.config = await loadConfig();
      this.loaded = true;
    }
  }

  async get<T>(path: string): Promise<T> {
    await this.ensureConfig();
    return this.request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    await this.ensureConfig();
    return this.request<T>('POST', path, body);
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    await this.ensureConfig();
    return this.request<T>('PATCH', path, body);
  }

  async delete(path: string): Promise<void> {
    await this.ensureConfig();
    const res = await this.fetch('DELETE', path);
    if (res.status === 204) return;

    if (!res.ok) {
      await this.throwError(res);
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetch(method, path, body);

    if (!res.ok) {
      await this.throwError(res);
    }

    return (await res.json()) as T;
  }

  private async fetch(method: string, path: string, body?: unknown): Promise<Response> {
    const url = `${this.config.baseUrl}${path}`;
    const init: RequestInit = {
      method,
      headers: { ...this.config.headers },
    };
    if (body !== undefined) {
      (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    } else {
      delete (init.headers as Record<string, string>)['Content-Type'];
    }
    return globalThis.fetch(url, init);
  }

  private async throwError(res: Response): Promise<never> {
    let code = 'unknown_error';
    let message = `Request failed with status ${res.status}`;

    try {
      const json = (await res.json()) as { code?: string; message?: string };
      if (json.code) code = json.code;
      if (json.message) message = json.message;
    } catch {
      // use defaults
    }

    throw new ApiClientError(res.status, code, message);
  }
}

/** Singleton client instance used by all command handlers. */
export const client = new ApiClient();
