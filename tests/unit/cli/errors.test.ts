import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import {
  CliError,
  apiStatusToExitCode,
  apiErrorFromClient,
  usageError,
  USAGE_EXIT_CODE,
  handleError,
} from '../../../src/cli/errors';
import { MissingFlagError } from '../../../src/cli/prompt';
import { ApiClientError } from '../../../src/cli/client';

// ---------------------------------------------------------------------------
// apiStatusToExitCode
// ---------------------------------------------------------------------------

describe('apiStatusToExitCode', () => {
  test('maps 400 → 22 (validation)', () => {
    expect(apiStatusToExitCode(400)).toBe(22);
  });

  test('maps 401 → 77 (auth)', () => {
    expect(apiStatusToExitCode(401)).toBe(77);
  });

  test('maps 403 → 79 (forbidden)', () => {
    expect(apiStatusToExitCode(403)).toBe(79);
  });

  test('maps 404 → 78 (not found)', () => {
    expect(apiStatusToExitCode(404)).toBe(78);
  });

  test('maps 409 → 80 (conflict)', () => {
    expect(apiStatusToExitCode(409)).toBe(80);
  });

  test('maps 422 → 22 (validation)', () => {
    expect(apiStatusToExitCode(422)).toBe(22);
  });

  test('maps 500 → 1 (general)', () => {
    expect(apiStatusToExitCode(500)).toBe(1);
  });

  test('maps 502 → 1 (general)', () => {
    expect(apiStatusToExitCode(502)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// CliError
// ---------------------------------------------------------------------------

describe('CliError', () => {
  test('stores exitCode, code, and message', () => {
    const err = new CliError(22, 'validation_error', 'Bad input');
    expect(err.exitCode).toBe(22);
    expect(err.code).toBe('validation_error');
    expect(err.message).toBe('Bad input');
    expect(err.name).toBe('CliError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CliError);
  });

  test('toJSON() produces the error envelope', () => {
    const err = new CliError(78, 'not_found', 'Ingredient not found');
    expect(err.toJSON()).toEqual({
      error: {
        exitCode: 78,
        code: 'not_found',
        message: 'Ingredient not found',
      },
    });
  });

  test('toJSON() includes extra fields', () => {
    const err = new CliError(2, 'missing_flag', 'Missing --name', { flag: 'name' });
    expect(err.toJSON()).toEqual({
      error: {
        exitCode: 2,
        code: 'missing_flag',
        message: 'Missing --name',
        flag: 'name',
      },
    });
  });
});

// ---------------------------------------------------------------------------
// MissingFlagError
// ---------------------------------------------------------------------------

describe('MissingFlagError', () => {
  test('has exitCode 2 and code missing_flag', () => {
    const err = new MissingFlagError('storage-type');
    expect(err.exitCode).toBe(2);
    expect(err.code).toBe('missing_flag');
    expect(err.flag).toBe('storage-type');
    expect(err.message).toBe(
      'Missing required flag: --storage-type. Provide it or run interactively.'
    );
    expect(err).toBeInstanceOf(CliError);
    expect(err).toBeInstanceOf(Error);
  });

  test('toJSON() includes flag field', () => {
    const err = new MissingFlagError('email');
    const json = err.toJSON();
    expect(json.error).toMatchObject({ flag: 'email' });
  });
});

// ---------------------------------------------------------------------------
// usageError()
// ---------------------------------------------------------------------------

describe('usageError', () => {
  test('creates a CliError with exitCode 2 and code usage_error', () => {
    const err = usageError('Bad arg');
    expect(err).toBeInstanceOf(CliError);
    expect(err.exitCode).toBe(USAGE_EXIT_CODE);
    expect(err.code).toBe('usage_error');
    expect(err.message).toBe('Bad arg');
  });
});

// ---------------------------------------------------------------------------
// apiErrorFromClient()
// ---------------------------------------------------------------------------

describe('apiErrorFromClient', () => {
  test('maps ApiClientError 404 → CliError exitCode 78', () => {
    const apiErr = new ApiClientError(404, 'not_found', 'Ingredient not found');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr).toBeInstanceOf(CliError);
    expect(cliErr.exitCode).toBe(78);
    expect(cliErr.code).toBe('not_found');
    expect(cliErr.message).toBe('Ingredient not found');
  });

  test('maps ApiClientError 401 → CliError exitCode 77', () => {
    const apiErr = new ApiClientError(401, 'invalid_credentials', 'Invalid login');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr.exitCode).toBe(77);
    expect(cliErr.code).toBe('invalid_credentials');
  });

  test('maps ApiClientError 409 → CliError exitCode 80', () => {
    const apiErr = new ApiClientError(409, 'ingredient_name_conflict', 'Name taken');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr.exitCode).toBe(80);
    expect(cliErr.code).toBe('ingredient_name_conflict');
  });

  test('maps ApiClientError 422 → CliError exitCode 22', () => {
    const apiErr = new ApiClientError(422, 'validation_error', 'name is required');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr.exitCode).toBe(22);
  });

  test('maps ApiClientError 500 → CliError exitCode 1', () => {
    const apiErr = new ApiClientError(500, 'unknown_error', 'Internal error');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr.exitCode).toBe(1);
  });

  test('preserves the API code in the CliError', () => {
    const apiErr = new ApiClientError(422, 'invalid_storage_type', 'Bad type');
    const cliErr = apiErrorFromClient(apiErr);
    expect(cliErr.code).toBe('invalid_storage_type');
    expect((cliErr.toJSON().error as Record<string, unknown>).code).toBe('invalid_storage_type');
  });
});

// ---------------------------------------------------------------------------
// handleError() — integration-style tests
// ---------------------------------------------------------------------------
// These mock console.log, console.error, and process.exit to verify the
// full error rendering path without actually terminating the process.

describe('handleError', () => {
  let stdoutLines: string[];
  let stderrLines: string[];
  let exitCode: number | undefined;
  let origLog: typeof console.log;
  let origError: typeof console.error;
  let origExit: typeof process.exit;

  beforeEach(() => {
    stdoutLines = [];
    stderrLines = [];
    exitCode = undefined;
    origLog = console.log;
    origError = console.error;
    origExit = process.exit;

    console.log = (...args: unknown[]) => {
      stdoutLines.push(args.map(String).join(' '));
    };
    console.error = (...args: unknown[]) => {
      stderrLines.push(args.map(String).join(' '));
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (process as any).exit = ((code?: number) => {
      exitCode = code ?? 0;
    }) as never;
  });

  afterEach(() => {
    console.log = origLog;
    console.error = origError;
    process.exit = origExit;
  });

  // --- JSON mode ---

  test('JSON mode: ApiClientError produces JSON envelope on stdout with correct exit code', () => {
    const err = new ApiClientError(404, 'not_found', 'Ingredient not found');
    handleError(err, true);

    expect(exitCode).toBe(78);
    expect(stderrLines.length).toBe(0);
    const parsed = JSON.parse(stdoutLines[0]!);
    expect(parsed.error).toEqual({
      exitCode: 78,
      code: 'not_found',
      message: 'Ingredient not found',
    });
  });

  test('JSON mode: ApiClientError 401 → exit code 77', () => {
    handleError(new ApiClientError(401, 'invalid_credentials', 'Bad login'), true);
    expect(exitCode).toBe(77);
    const parsed = JSON.parse(stdoutLines[0]!);
    expect(parsed.error.code).toBe('invalid_credentials');
  });

  test('JSON mode: ApiClientError 409 → exit code 80', () => {
    handleError(new ApiClientError(409, 'ingredient_name_conflict', 'Name taken'), true);
    expect(exitCode).toBe(80);
  });

  test('JSON mode: ApiClientError 422 → exit code 22', () => {
    handleError(new ApiClientError(422, 'validation_error', 'Bad input'), true);
    expect(exitCode).toBe(22);
  });

  test('JSON mode: MissingFlagError includes flag name in envelope', () => {
    handleError(new MissingFlagError('storage-type'), true);
    expect(exitCode).toBe(2);
    const parsed = JSON.parse(stdoutLines[0]!);
    expect(parsed.error).toEqual({
      exitCode: 2,
      code: 'missing_flag',
      message: 'Missing required flag: --storage-type. Provide it or run interactively.',
      flag: 'storage-type',
    });
  });

  test('JSON mode: usageError (unknown command) produces correct envelope', () => {
    handleError(usageError('Unknown command: blarg'), true);
    expect(exitCode).toBe(2);
    const parsed = JSON.parse(stdoutLines[0]!);
    expect(parsed.error.code).toBe('usage_error');
    expect(parsed.error.message).toBe('Unknown command: blarg');
  });

  test('JSON mode: plain Error gets wrapped as unknown_error with exit code 1', () => {
    handleError(new Error('something unexpected'), true);
    expect(exitCode).toBe(1);
    const parsed = JSON.parse(stdoutLines[0]!);
    expect(parsed.error).toEqual({
      exitCode: 1,
      code: 'unknown_error',
      message: 'something unexpected',
    });
  });

  // --- Human mode ---

  test('human mode: writes "Error: <msg>" to stderr with exit code 1', () => {
    handleError(new ApiClientError(404, 'not_found', 'Not found'), false);
    expect(exitCode).toBe(1);
    expect(stdoutLines.length).toBe(0);
    expect(stderrLines).toEqual(['Error: Not found']);
  });

  test('human mode: usage error also exits with code 1', () => {
    handleError(usageError('Bad args'), false);
    expect(exitCode).toBe(1);
    expect(stderrLines).toEqual(['Error: Bad args']);
  });

  test('human mode: MissingFlagError exits with code 1 and human message', () => {
    handleError(new MissingFlagError('name'), false);
    expect(exitCode).toBe(1);
    expect(stderrLines[0]).toBe(
      'Error: Missing required flag: --name. Provide it or run interactively.'
    );
  });
});
