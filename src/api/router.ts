import type { PrismaClient } from '@prisma/client';
import { jsonError } from './errors';
import { ApiProblem } from './api-problem';
import type { ApiContext } from './handlers/me-household';
import {
  handleGetHousehold,
  handleGetHouseholdMembers,
  handleGetMe,
  handlePatchHousehold,
  handlePatchMe,
} from './handlers/me-household';
import {
  handleDeleteIngredient,
  handleGetIngredient,
  handleListIngredients,
  handlePatchIngredient,
  handlePostIngredient,
} from './handlers/ingredients';
import {
  bulkUpsertDayPlans,
  createDayPlan,
  deleteDayPlan,
  getDayPlan,
  listDayPlans,
  patchDayPlan,
} from './services/day-plans-service';
import {
  createMeal,
  deleteMeal,
  getMeal,
  listMeals,
  randomMeal,
  updateMeal,
} from './services/meals-service';
import { isUuid } from './uuid';

function segments(pathname: string): string[] {
  return pathname.replace(/\/+$/, '').split('/').filter(Boolean);
}

/** For 405 responses: allowed methods for this documented `/api/*` path, or `null` if unknown. */
export function apiAllowedMethodsForPathname(pathname: string): string[] | null {
  const segs = segments(pathname);
  if (segs[0] !== 'api') return null;
  const rest = segs.slice(1);

  if (rest.length === 1 && rest[0] === 'me') return ['GET', 'PATCH'];
  if (rest.length === 1 && rest[0] === 'household') return ['GET', 'PATCH'];
  if (rest.length === 2 && rest[0] === 'household' && rest[1] === 'members') return ['GET'];
  if (rest.length === 1 && rest[0] === 'ingredients') return ['GET', 'POST'];
  if (rest.length === 2 && rest[0] === 'ingredients' && isUuid(rest[1]!)) {
    return ['GET', 'PATCH', 'DELETE'];
  }
  if (rest.length === 1 && rest[0] === 'meals') return ['GET', 'POST'];
  if (rest.length === 2 && rest[0] === 'meals' && rest[1] === 'random') return ['GET'];
  if (rest.length === 2 && rest[0] === 'meals' && isUuid(rest[1]!)) {
    return ['GET', 'PATCH', 'DELETE'];
  }
  if (rest.length === 1 && rest[0] === 'day-plans') return ['GET', 'POST'];
  if (rest.length === 2 && rest[0] === 'day-plans' && rest[1] === 'bulk') return ['POST'];
  if (rest.length === 2 && rest[0] === 'day-plans' && isUuid(rest[1]!)) {
    return ['GET', 'PATCH', 'DELETE'];
  }
  return null;
}

async function wrap(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (e) {
    if (e instanceof ApiProblem) {
      return jsonError(e.status, e.code, e.message);
    }
    throw e;
  }
}

export function dispatchApi(
  req: Request,
  prisma: PrismaClient,
  ctx: ApiContext
): Promise<Response | null> {
  const url = new URL(req.url);
  const segs = segments(url.pathname);
  if (segs[0] !== 'api') return Promise.resolve(null);

  const method = req.method;
  const [, ...rest] = segs;

  // /api/me
  if (rest.length === 1 && rest[0] === 'me') {
    if (method === 'GET') return wrap(() => handleGetMe(ctx));
    if (method === 'PATCH') return wrap(() => handlePatchMe(req, ctx));
    return Promise.resolve(null);
  }

  // /api/household
  if (rest.length === 1 && rest[0] === 'household') {
    if (method === 'GET') return wrap(() => handleGetHousehold(ctx));
    if (method === 'PATCH') return wrap(() => handlePatchHousehold(req, ctx));
    return Promise.resolve(null);
  }

  // /api/household/members
  if (rest.length === 2 && rest[0] === 'household' && rest[1] === 'members') {
    if (method === 'GET') return wrap(() => handleGetHouseholdMembers(ctx));
    return Promise.resolve(null);
  }

  // /api/ingredients
  if (rest.length === 1 && rest[0] === 'ingredients') {
    if (method === 'GET') return wrap(() => handleListIngredients(url, ctx));
    if (method === 'POST') return wrap(() => handlePostIngredient(req, ctx));
    return Promise.resolve(null);
  }

  // /api/ingredients/:id
  if (rest.length === 2 && rest[0] === 'ingredients' && isUuid(rest[1]!)) {
    const id = rest[1]!;
    if (method === 'GET') return wrap(() => handleGetIngredient(id, ctx));
    if (method === 'PATCH') return wrap(() => handlePatchIngredient(id, req, ctx));
    if (method === 'DELETE') return wrap(() => handleDeleteIngredient(id, ctx));
    return Promise.resolve(null);
  }

  // /api/meals
  if (rest.length === 1 && rest[0] === 'meals') {
    if (method === 'GET') return wrap(() => listMeals(url, ctx));
    if (method === 'POST') return wrap(() => createMeal(req, ctx));
    return Promise.resolve(null);
  }

  // /api/meals/random
  if (rest.length === 2 && rest[0] === 'meals' && rest[1] === 'random') {
    if (method === 'GET') return wrap(() => randomMeal(url, ctx));
    return Promise.resolve(null);
  }

  // /api/meals/:id
  if (rest.length === 2 && rest[0] === 'meals' && isUuid(rest[1]!)) {
    const id = rest[1]!;
    if (method === 'GET') return wrap(() => getMeal(id, ctx));
    if (method === 'PATCH') return wrap(() => updateMeal(id, req, ctx));
    if (method === 'DELETE') return wrap(() => deleteMeal(id, ctx));
    return Promise.resolve(null);
  }

  // /api/day-plans
  if (rest.length === 1 && rest[0] === 'day-plans') {
    if (method === 'GET') return wrap(() => listDayPlans(url, ctx));
    if (method === 'POST') return wrap(() => createDayPlan(req, ctx));
    return Promise.resolve(null);
  }

  // /api/day-plans/bulk
  if (rest.length === 2 && rest[0] === 'day-plans' && rest[1] === 'bulk') {
    if (method === 'POST') return wrap(() => bulkUpsertDayPlans(req, ctx));
    return Promise.resolve(null);
  }

  // /api/day-plans/:id
  if (rest.length === 2 && rest[0] === 'day-plans' && isUuid(rest[1]!)) {
    const id = rest[1]!;
    if (method === 'GET') return wrap(() => getDayPlan(id, ctx));
    if (method === 'PATCH') return wrap(() => patchDayPlan(id, req, ctx));
    if (method === 'DELETE') return wrap(() => deleteDayPlan(id, ctx));
    return Promise.resolve(null);
  }

  return Promise.resolve(null);
}
