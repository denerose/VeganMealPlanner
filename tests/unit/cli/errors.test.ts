import { describe, expect, test } from 'bun:test';
import {
  CliError,
  apiStatusToExitCode,
  apiErrorFromClient,
  usageError,
  USAGE_EXIT_CODE,
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
