import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import { toIngredientId, toUserId } from '../../../src/domain/types/ids';
import { parseMealCreate, parseMealUpdate } from '../../../src/api/services/meals-service';

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

describe('parseMealCreate', () => {
  it('parses a full create body', () => {
    const dto = parseMealCreate({
      name: ' Chickpea Curry ',
      description: ' Coconutty ',
      recipeUrl: 'https://example.org/curry',
      imageId: null,
      qualities: { isCreamy: true },
      heroIngredientIds: [{ ingredientId: 'ing-1' }, { ingredientId: 'ing-2', sortOrder: 3 }],
      cookedByUserIds: ['user-1'],
    });
    expect(dto.name).toBe(' Chickpea Curry ');
    expect(dto.description).toBe(' Coconutty ');
    expect(dto.recipeUrl).toBe('https://example.org/curry');
    expect(dto.imageId).toBeNull();
    expect(dto.qualities).toEqual({ isCreamy: true });
    expect(dto.heroIngredientIds).toEqual([
      { ingredientId: toIngredientId('ing-1') },
      { ingredientId: toIngredientId('ing-2'), sortOrder: 3 },
    ]);
    expect(dto.cookedByUserIds).toEqual([toUserId('user-1')]);
  });

  it('parses a minimal create body with only a name', () => {
    const dto = parseMealCreate({ name: 'Buddha Bowl' });
    expect(dto.name).toBe('Buddha Bowl');
    expect(dto.description).toBeUndefined();
    expect(dto.heroIngredientIds).toBeUndefined();
  });

  it('rejects non-object bodies with 422 instead of crashing', () => {
    for (const bad of [null, ['name'], 'curry', 5]) {
      const e = catchProblem(() => parseMealCreate(bad));
      expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
    }
  });

  it('requires a non-empty name', () => {
    for (const bad of [undefined, 5, '', '  ']) {
      const e = catchProblem(() => parseMealCreate({ name: bad }));
      expectApiProblem(e, 422, 'invalid_body', 'name is required');
    }
  });

  it('rejects wrong-typed scalar fields', () => {
    const cases: [string, Record<string, unknown>, string][] = [
      ['description', { name: 'M', description: 7 }, 'description must be a string'],
      ['recipeUrl', { name: 'M', recipeUrl: 7 }, 'recipeUrl must be a string or null'],
      ['imageId', { name: 'M', imageId: 7 }, 'imageId must be a string or null'],
    ];
    for (const [, body, message] of cases) {
      const e = catchProblem(() => parseMealCreate(body));
      expectApiProblem(e, 422, 'invalid_body', message);
    }
  });

  it('validates qualities shape', () => {
    const notObject = catchProblem(() => parseMealCreate({ name: 'M', qualities: 'creamy' }));
    expectApiProblem(notObject, 422, 'invalid_body', 'qualities must be an object');

    const badFlag = catchProblem(() =>
      parseMealCreate({ name: 'M', qualities: { isGreasy: 'very' } })
    );
    expectApiProblem(badFlag, 422, 'invalid_body', 'qualities.isGreasy must be a boolean');
  });

  it('validates heroIngredientIds shape', () => {
    const message = 'heroIngredientIds must be an array of { ingredientId, sortOrder? } objects';
    for (const bad of ['ing-1', [5], [{ ingredientId: 5 }], [{ sortOrder: 'a' }], [{}]]) {
      const e = catchProblem(() => parseMealCreate({ name: 'M', heroIngredientIds: bad }));
      expectApiProblem(e, 422, 'invalid_body', message);
    }
  });

  it('validates cookedByUserIds shape', () => {
    const e = catchProblem(() => parseMealCreate({ name: 'M', cookedByUserIds: 'user-1' }));
    expectApiProblem(e, 422, 'invalid_body', 'cookedByUserIds must be an array of strings');
  });
});

describe('parseMealUpdate', () => {
  it('parses empty and partial updates', () => {
    expect(parseMealUpdate({})).toEqual({});
    expect(parseMealUpdate({ name: ' Tempeh ', cookedByUserIds: [] })).toEqual({
      name: ' Tempeh ',
      cookedByUserIds: [],
    });
  });

  it('rejects non-object bodies with 422', () => {
    const e = catchProblem(() => parseMealUpdate(null));
    expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
  });

  it('rejects wrong-typed fields', () => {
    const nameNum = catchProblem(() => parseMealUpdate({ name: 7 }));
    expectApiProblem(nameNum, 422, 'invalid_body', 'name must be a string');

    const cooked = catchProblem(() => parseMealUpdate({ cookedByUserIds: [1] }));
    expectApiProblem(cooked, 422, 'invalid_body', 'cookedByUserIds must be an array of strings');

    const hero = catchProblem(() => parseMealUpdate({ heroIngredientIds: 'ing-1' }));
    expectApiProblem(
      hero,
      422,
      'invalid_body',
      'heroIngredientIds must be an array of { ingredientId, sortOrder? } objects'
    );
  });
});
