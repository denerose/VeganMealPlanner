import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import { parseHouseholdPatch, parseUserPatch } from '../../../src/api/handlers/me-household';
import {
  parseIngredientCreate,
  parseIngredientUpdate,
} from '../../../src/api/handlers/ingredients';

function expectApiProblem(e: unknown, status: number, code: string, message?: string) {
  expect(e).toBeInstanceOf(ApiProblem);
  const p = e as ApiProblem;
  expect(p.status).toBe(status);
  expect(p.code).toBe(code);
  if (message !== undefined) expect(p.message).toBe(message);
}

function catchProblem(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e) {
    return e;
  }
  throw new Error('expected function to throw');
}

describe('parseIngredientCreate', () => {
  it('parses a full create body', () => {
    const dto = parseIngredientCreate({
      name: ' Firm Tofu ',
      storageType: 'REFRIGERATED',
      perishable: true,
    });
    expect(dto).toEqual({ name: ' Firm Tofu ', storageType: 'REFRIGERATED', perishable: true });
  });

  it('allows omitting perishable', () => {
    const dto = parseIngredientCreate({ name: 'Chickpeas', storageType: 'PANTRY' });
    expect(dto.perishable).toBeUndefined();
  });

  it('rejects non-object bodies with 422 instead of crashing', () => {
    for (const bad of [null, ['name'], 'tofu', 5]) {
      const e = catchProblem(() => parseIngredientCreate(bad));
      expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
    }
  });

  it('keeps existing required-field messages', () => {
    const missingName = catchProblem(() => parseIngredientCreate({ storageType: 'PANTRY' }));
    expectApiProblem(missingName, 422, 'invalid_body', 'name is required');

    const blankName = catchProblem(() =>
      parseIngredientCreate({ name: '  ', storageType: 'PANTRY' })
    );
    expectApiProblem(blankName, 422, 'invalid_body', 'name is required');

    const missingType = catchProblem(() => parseIngredientCreate({ name: 'Tofu' }));
    expectApiProblem(missingType, 422, 'invalid_body', 'storageType is required');
  });

  it('rejects unknown storageType values', () => {
    const e = catchProblem(() => parseIngredientCreate({ name: 'Tofu', storageType: 'cellar' }));
    expectApiProblem(
      e,
      422,
      'invalid_body',
      'storageType must be one of: PANTRY, REFRIGERATED, FROZEN, FRESH'
    );
  });

  it('rejects non-boolean perishable', () => {
    const e = catchProblem(() =>
      parseIngredientCreate({ name: 'Tofu', storageType: 'PANTRY', perishable: 'no' })
    );
    expectApiProblem(e, 422, 'invalid_body', 'perishable must be a boolean');
  });
});

describe('parseIngredientUpdate', () => {
  it('parses partial updates', () => {
    expect(parseIngredientUpdate({})).toEqual({});
    expect(parseIngredientUpdate({ name: ' Silken Tofu ' })).toEqual({ name: ' Silken Tofu ' });
    expect(parseIngredientUpdate({ storageType: 'FROZEN' })).toEqual({ storageType: 'FROZEN' });
    expect(parseIngredientUpdate({ perishable: false })).toEqual({ perishable: false });
  });

  it('rejects non-object bodies with 422', () => {
    const e = catchProblem(() => parseIngredientUpdate(null));
    expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
  });

  it('keeps the existing empty-name message', () => {
    const e = catchProblem(() => parseIngredientUpdate({ name: '' }));
    expectApiProblem(e, 422, 'invalid_body', 'name must not be empty');
  });

  it('rejects wrong-typed fields', () => {
    const nameNum = catchProblem(() => parseIngredientUpdate({ name: 7 }));
    expectApiProblem(nameNum, 422, 'invalid_body', 'name must be a string');

    const typeBad = catchProblem(() => parseIngredientUpdate({ storageType: 'cellar' }));
    expectApiProblem(
      typeBad,
      422,
      'invalid_body',
      'storageType must be one of: PANTRY, REFRIGERATED, FROZEN, FRESH'
    );

    const perBad = catchProblem(() => parseIngredientUpdate({ perishable: 1 }));
    expectApiProblem(perBad, 422, 'invalid_body', 'perishable must be a boolean');
  });
});

describe('parseUserPatch', () => {
  it('parses absent, null, and string displayName', () => {
    expect(parseUserPatch({})).toEqual({});
    expect(parseUserPatch({ displayName: null })).toEqual({ displayName: null });
    expect(parseUserPatch({ displayName: 'Kim' })).toEqual({ displayName: 'Kim' });
  });

  it('rejects non-object bodies with 422', () => {
    const e = catchProblem(() => parseUserPatch([]));
    expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
  });

  it('rejects non-string displayName', () => {
    const e = catchProblem(() => parseUserPatch({ displayName: 42 }));
    expectApiProblem(e, 422, 'invalid_body', 'displayName must be a string or null');
  });
});

describe('parseHouseholdPatch', () => {
  it('parses absent, null, and string name', () => {
    expect(parseHouseholdPatch({})).toEqual({});
    expect(parseHouseholdPatch({ name: null })).toEqual({ name: null });
    expect(parseHouseholdPatch({ name: 'Vegan HQ' })).toEqual({ name: 'Vegan HQ' });
  });

  it('rejects non-object bodies with 422', () => {
    const e = catchProblem(() => parseHouseholdPatch('rename'));
    expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
  });

  it('rejects non-string name', () => {
    const e = catchProblem(() => parseHouseholdPatch({ name: 9 }));
    expectApiProblem(e, 422, 'invalid_body', 'name must be a string or null');
  });
});
