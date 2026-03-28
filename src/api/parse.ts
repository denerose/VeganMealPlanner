import { ApiProblem } from './api-problem';
import { planDateFromYmd } from '../domain/lib/plan-date';

export async function readJsonBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiProblem(422, 'invalid_json', 'Request body must be JSON');
  }
}

/** `undefined` = omit filter; `true`/`false` = constrain column */
export function parseBoolQuery(value: string | null): boolean | undefined {
  if (value === null) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ApiProblem(422, 'invalid_query', `Expected true or false, got ${value}`);
}

export function parseYmdParam(name: string, value: string | null): string {
  if (!value?.trim()) {
    throw new ApiProblem(422, 'invalid_query', `Query ${name} is required (YYYY-MM-DD)`);
  }
  try {
    planDateFromYmd(value.trim());
    return value.trim();
  } catch {
    throw new ApiProblem(422, 'invalid_query', `Query ${name} must be YYYY-MM-DD`);
  }
}

export function parseOptionalYmd(name: string, value: string | null): string | undefined {
  if (value === null || value === '') return undefined;
  try {
    planDateFromYmd(value.trim());
    return value.trim();
  } catch {
    throw new ApiProblem(422, 'invalid_query', `Query ${name} must be YYYY-MM-DD`);
  }
}

export function parseLimitOffset(url: URL): { limit: number; offset: number } {
  const limitRaw = url.searchParams.get('limit');
  const offsetRaw = url.searchParams.get('offset');
  const limit = limitRaw === null ? 50 : Number(limitRaw);
  const offset = offsetRaw === null ? 0 : Number(offsetRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiProblem(422, 'invalid_query', 'limit must be an integer between 1 and 100');
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiProblem(422, 'invalid_query', 'offset must be a non-negative integer');
  }
  return { limit, offset };
}

export function collectHeroIngredientIds(searchParams: URLSearchParams): string[] {
  return searchParams.getAll('heroIngredientId').filter((s) => s.length > 0);
}

const DAY_PLAN_MAX_SPAN = 93;

export function parseDayPlanRange(url: URL): { from: string; to: string } {
  const from = parseYmdParam('from', url.searchParams.get('from'));
  const to = parseYmdParam('to', url.searchParams.get('to'));
  const fromD = planDateFromYmd(from);
  const toD = planDateFromYmd(to);
  if (fromD.getTime() > toD.getTime()) {
    throw new ApiProblem(422, 'invalid_query', 'from must be on or before to');
  }
  const spanDays = Math.round((toD.getTime() - fromD.getTime()) / 86400000) + 1;
  if (spanDays > DAY_PLAN_MAX_SPAN) {
    throw new ApiProblem(
      422,
      'invalid_query',
      `Date range must be at most ${DAY_PLAN_MAX_SPAN} days`
    );
  }
  return { from, to };
}
