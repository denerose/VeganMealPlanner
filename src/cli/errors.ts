import { ApiClientError } from './client';

/** Exit code for usage errors (missing flags, unknown commands, bad args). */
export const USAGE_EXIT_CODE = 2;

/**
 * Map an HTTP status code from the API to a CLI exit code.
 *
 * | HTTP | Exit | Meaning        |
 * |------|------|----------------|
 * | 400  |   22 | Bad request    |
 * | 401  |   77 | Unauthorized   |
 * | 403  |   79 | Forbidden      |
 * | 404  |   78 | Not found      |
 * | 409  |   80 | Conflict       |
 * | 422  |   22 | Validation     |
 * | other|    1 | General error  |
 */
export function apiStatusToExitCode(status: number): number {
  switch (status) {
    case 400:
    case 422:
      return 22;
    case 401:
      return 77;
    case 403:
      return 79;
    case 404:
      return 78;
    case 409:
      return 80;
    default:
      return 1;
  }
}

/**
 * Structured CLI error with a machine-readable code and exit code.
 *
 * In `--json` mode the error is serialised to stdout as:
 * ```json
 * { "error": { "exitCode": 2, "code": "usage_error", "message": "..." } }
 * ```
 */
export class CliError extends Error {
  /** Extra fields to include in the JSON envelope (e.g. `flag` for MissingFlagError). */
  readonly extra: Record<string, unknown>;

  constructor(
    public readonly exitCode: number,
    public readonly code: string,
    message: string,
    extra: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'CliError';
    this.extra = extra;
  }

  /** Serialise into the JSON envelope `{ error: { ... } }`. */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        exitCode: this.exitCode,
        code: this.code,
        message: this.message,
        ...this.extra,
      },
    };
  }
}

/** Convenience: create a usage error (missing flag, unknown command, etc.). */
export function usageError(message: string): CliError {
  return new CliError(USAGE_EXIT_CODE, 'usage_error', message);
}

/** Convert an ApiClientError into a CliError, preserving the API code. */
export function apiErrorFromClient(error: ApiClientError): CliError {
  return new CliError(apiStatusToExitCode(error.status), error.code, error.message);
}

/**
 * Normalise any thrown value into a CliError.
 *
 * - `CliError` → pass through
 * - `ApiClientError` → map via `apiErrorFromClient`
 * - `Error` → wrap as `CliError(1, 'unknown_error', ...)`
 * - anything else → rethrow
 */
export function toCliError(e: unknown): CliError {
  if (e instanceof CliError) {
    return e;
  }
  if (e instanceof ApiClientError) {
    return apiErrorFromClient(e);
  }
  if (e instanceof Error) {
    return new CliError(1, 'unknown_error', e.message);
  }
  throw e;
}

/**
 * Handle an error consistently:
 * - `--json` mode → JSON error envelope on **stdout**, differentiated exit code
 * - human mode → `"Error: <msg>"` on **stderr**, exit code 1
 *
 * This function never returns (calls `process.exit`).
 */
export function handleError(e: unknown, json: boolean): never {
  const cliError = toCliError(e);

  if (json) {
    console.log(JSON.stringify(cliError.toJSON(), null, 2));
    process.exit(cliError.exitCode);
  } else {
    console.error(`Error: ${cliError.message}`);
    process.exit(1);
  }
}
