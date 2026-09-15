import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import {
  asArray,
  asObject,
  optionalBoolean,
  optionalEnum,
  optionalNullableString,
  optionalObject,
  optionalString,
  optionalStringArray,
  requiredEnum,
  requiredString,
} from '../../../src/api/validate';

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

describe('asObject', () => {
  it('returns plain objects', () => {
    expect(asObject({ a: 1 })).toEqual({ a: 1 });
  });

  it('rejects non-object bodies with 422 invalid_body', () => {
    for (const bad of [null, [1, 2], 'x', 5, true]) {
      const e = catchProblem(() => asObject(bad));
      expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
    }
  });
});

describe('asArray', () => {
  it('returns arrays', () => {
    expect(asArray([1, 2])).toEqual([1, 2]);
  });

  it('rejects non-array bodies with 422 invalid_body', () => {
    for (const bad of [null, { a: 1 }, 'x', 5]) {
      const e = catchProblem(() => asArray(bad));
      expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON array');
    }
  });
});

describe('requiredString', () => {
  it('returns the value when present', () => {
    expect(requiredString({ name: ' Tofu ' }, 'name')).toBe(' Tofu ');
  });

  it('throws 422 when missing, non-string, or blank', () => {
    for (const bad of [undefined, null, 5, '', '   ']) {
      const e = catchProblem(() => requiredString({ name: bad }, 'name'));
      expectApiProblem(e, 422, 'invalid_body', 'name is required');
    }
  });
});

describe('optionalString', () => {
  it('returns undefined when absent', () => {
    expect(optionalString({}, 'description')).toBeUndefined();
    expect(optionalString({ description: undefined }, 'description')).toBeUndefined();
  });

  it('returns strings unchanged', () => {
    expect(optionalString({ description: ' Creamy ' }, 'description')).toBe(' Creamy ');
  });

  it('throws 422 for non-strings (including null)', () => {
    for (const bad of [null, 5, true, []]) {
      const e = catchProblem(() => optionalString({ description: bad }, 'description'));
      expectApiProblem(e, 422, 'invalid_body', 'description must be a string');
    }
  });
});

describe('optionalNullableString', () => {
  it('returns undefined when absent and null when null', () => {
    expect(optionalNullableString({}, 'displayName')).toBeUndefined();
    expect(optionalNullableString({ displayName: null }, 'displayName')).toBeNull();
    expect(optionalNullableString({ displayName: 'Kim' }, 'displayName')).toBe('Kim');
  });

  it('throws 422 for other non-strings', () => {
    const e = catchProblem(() => optionalNullableString({ displayName: 5 }, 'displayName'));
    expectApiProblem(e, 422, 'invalid_body', 'displayName must be a string or null');
  });
});

describe('optionalBoolean', () => {
  it('returns undefined, true, and false', () => {
    expect(optionalBoolean({}, 'perishable')).toBeUndefined();
    expect(optionalBoolean({ perishable: true }, 'perishable')).toBe(true);
    expect(optionalBoolean({ perishable: false }, 'perishable')).toBe(false);
  });

  it('throws 422 for non-booleans', () => {
    const e = catchProblem(() => optionalBoolean({ perishable: 'yes' }, 'perishable'));
    expectApiProblem(e, 422, 'invalid_body', 'perishable must be a boolean');
  });
});

describe('requiredEnum', () => {
  const values = ['PANTRY', 'FROZEN'] as const;

  it('returns a valid value', () => {
    expect(requiredEnum({ storageType: 'FROZEN' }, 'storageType', values)).toBe('FROZEN');
  });

  it('throws 422 when missing', () => {
    const e = catchProblem(() => requiredEnum({}, 'storageType', values));
    expectApiProblem(e, 422, 'invalid_body', 'storageType is required');
  });

  it('throws 422 for values outside the set', () => {
    const e = catchProblem(() => requiredEnum({ storageType: 'cellar' }, 'storageType', values));
    expectApiProblem(e, 422, 'invalid_body', 'storageType must be one of: PANTRY, FROZEN');
  });
});

describe('optionalEnum', () => {
  const values = ['PANTRY', 'FROZEN'] as const;

  it('returns undefined when absent and the value when valid', () => {
    expect(optionalEnum({}, 'storageType', values)).toBeUndefined();
    expect(optionalEnum({ storageType: 'PANTRY' }, 'storageType', values)).toBe('PANTRY');
  });

  it('throws 422 for values outside the set', () => {
    const e = catchProblem(() => optionalEnum({ storageType: 7 }, 'storageType', values));
    expectApiProblem(e, 422, 'invalid_body', 'storageType must be one of: PANTRY, FROZEN');
  });
});

describe('optionalStringArray', () => {
  it('returns undefined when absent and arrays of strings when present', () => {
    expect(optionalStringArray({}, 'cookedByUserIds')).toBeUndefined();
    expect(optionalStringArray({ cookedByUserIds: ['a', 'b'] }, 'cookedByUserIds')).toEqual([
      'a',
      'b',
    ]);
  });

  it('throws 422 for non-arrays or arrays with non-strings', () => {
    for (const bad of ['a', [1], ['a', null]]) {
      const e = catchProblem(() =>
        optionalStringArray({ cookedByUserIds: bad }, 'cookedByUserIds')
      );
      expectApiProblem(e, 422, 'invalid_body', 'cookedByUserIds must be an array of strings');
    }
  });
});

describe('optionalObject', () => {
  it('returns undefined when absent and records when present', () => {
    expect(optionalObject({}, 'qualities')).toBeUndefined();
    expect(optionalObject({ qualities: { isCreamy: true } }, 'qualities')).toEqual({
      isCreamy: true,
    });
  });

  it('throws 422 for null, arrays, and primitives', () => {
    for (const bad of [null, [true], 'yes']) {
      const e = catchProblem(() => optionalObject({ qualities: bad }, 'qualities'));
      expectApiProblem(e, 422, 'invalid_body', 'qualities must be an object');
    }
  });
});
