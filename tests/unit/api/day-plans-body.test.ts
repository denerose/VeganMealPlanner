import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import { toMealId } from '../../../src/domain/types/ids';
import {
  parseDayPlanBulk,
  parseDayPlanCreate,
  parseDayPlanUpdate,
} from '../../../src/api/services/day-plans-service';

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

describe('parseDayPlanCreate', () => {
  it('parses date with optional meal ids', () => {
    const minimal = parseDayPlanCreate({ date: '2026-05-20' });
    expect(minimal.date).toBe('2026-05-20');
    expect(minimal.lunchMealId).toBeUndefined();
    expect(minimal.dinnerMealId).toBeUndefined();

    const full = parseDayPlanCreate({
      date: '2026-05-20',
      lunchMealId: 'meal-1',
      dinnerMealId: null,
    });
    expect(full.date).toBe('2026-05-20');
    expect(full.lunchMealId).toBe(toMealId('meal-1'));
    expect(full.dinnerMealId).toBeNull();
  });

  it('rejects non-object bodies with 422 instead of crashing', () => {
    for (const bad of [null, ['2026-05-20'], 'x', 5]) {
      const e = catchProblem(() => parseDayPlanCreate(bad));
      expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
    }
  });

  it('keeps the existing date message for missing or malformed dates', () => {
    for (const bad of [undefined, 5, '20-05-2026', '2026-13-99']) {
      const e = catchProblem(() => parseDayPlanCreate({ date: bad }));
      expectApiProblem(e, 422, 'invalid_body', 'date must be YYYY-MM-DD');
    }
  });

  it('rejects wrong-typed meal ids', () => {
    const e = catchProblem(() => parseDayPlanCreate({ date: '2026-05-20', lunchMealId: 5 }));
    expectApiProblem(e, 422, 'invalid_body', 'lunchMealId must be a string or null');
  });
});

describe('parseDayPlanUpdate', () => {
  it('parses empty and partial updates', () => {
    expect(parseDayPlanUpdate({})).toEqual({});
    const dto = parseDayPlanUpdate({ lunchMealId: null, dinnerMealId: 'meal-2' });
    expect(dto.lunchMealId).toBeNull();
    expect(dto.dinnerMealId).toBe(toMealId('meal-2'));
  });

  it('rejects non-object bodies with 422', () => {
    const e = catchProblem(() => parseDayPlanUpdate('x'));
    expectApiProblem(e, 422, 'invalid_body', 'Request body must be a JSON object');
  });

  it('rejects wrong-typed meal ids', () => {
    const e = catchProblem(() => parseDayPlanUpdate({ dinnerMealId: 5 }));
    expectApiProblem(e, 422, 'invalid_body', 'dinnerMealId must be a string or null');
  });
});

describe('parseDayPlanBulk', () => {
  it('parses an array of items', () => {
    const items = parseDayPlanBulk([
      { date: '2026-05-20' },
      { date: '2026-05-21', lunchMealId: 'meal-1' },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]!.date).toBe('2026-05-20');
    expect(items[0]!.lunchMealId).toBeUndefined();
    expect(items[1]!.date).toBe('2026-05-21');
    expect(items[1]!.lunchMealId).toBe(toMealId('meal-1'));
  });

  it('accepts an empty array', () => {
    expect(parseDayPlanBulk([])).toEqual([]);
  });

  it('keeps the existing non-array message', () => {
    const e = catchProblem(() => parseDayPlanBulk({ date: '2026-05-20' }));
    expectApiProblem(e, 422, 'invalid_body', 'Body must be a JSON array');
  });

  it('rejects non-object items with 422 instead of crashing', () => {
    for (const bad of [null, '2026-05-20', 5]) {
      const e = catchProblem(() => parseDayPlanBulk([bad]));
      expectApiProblem(e, 422, 'invalid_body', 'each item must be a JSON object');
    }
  });

  it('keeps the existing invalid-date template', () => {
    const e = catchProblem(() => parseDayPlanBulk([{ date: '2026-13-99' }]));
    expectApiProblem(e, 422, 'invalid_body', 'Invalid date: 2026-13-99');
  });

  it('rejects wrong-typed meal ids on items', () => {
    const e = catchProblem(() => parseDayPlanBulk([{ date: '2026-05-20', dinnerMealId: 5 }]));
    expectApiProblem(e, 422, 'invalid_body', 'dinnerMealId must be a string or null');
  });
});
