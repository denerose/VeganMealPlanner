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
import { handlePostHouseholdInvitation } from './handlers/household-invitations';
import { handlePostLogin, handlePostLogout, handlePostRegister } from './handlers/auth';
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

export type RouteParams = Record<string, string>;

export type RouteHandler = (
  req: Request,
  url: URL,
  params: RouteParams,
  ctx: ApiContext
) => Promise<Response>;

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RouteDef {
  /** Documented route pattern; `:param` segments must be UUIDs (e.g. `/api/meals/:mealId`). */
  pattern: string;
  methods: Partial<Record<HttpMethod, RouteHandler>>;
}

/**
 * Single source of truth for documented `/api/*` routes.
 *
 * - `dispatchApi` routes requests to the `methods` handlers.
 * - `apiAllowedMethodsForPathname` (405 `Allow` headers) is derived from this table.
 * - `tests/unit/api/router-contract.test.ts` fails when this table and
 *   `contracts/openapi.yaml` drift apart (paths or methods).
 *
 * `server.ts` intercepts `/api/health` and `/api/auth/*` before dispatch for auth
 * ordering; their entries here keep routing, 405 behavior, and the contract in sync.
 */
const ROUTES: readonly RouteDef[] = [
  {
    pattern: '/api/health',
    methods: {
      GET: (_req, _url, _params, ctx) => healthResponse(ctx.prisma),
    },
  },
  {
    pattern: '/api/auth/register',
    methods: {
      POST: (req, _url, _params, ctx) => handlePostRegister(req, ctx.prisma),
    },
  },
  {
    pattern: '/api/auth/login',
    methods: {
      POST: (req, _url, _params, ctx) => handlePostLogin(req, ctx.prisma),
    },
  },
  {
    pattern: '/api/auth/logout',
    methods: {
      POST: (req) => handlePostLogout(req),
    },
  },
  {
    pattern: '/api/me',
    methods: {
      GET: (_req, _url, _params, ctx) => handleGetMe(ctx),
      PATCH: (req, _url, _params, ctx) => handlePatchMe(req, ctx),
    },
  },
  {
    pattern: '/api/household',
    methods: {
      GET: (_req, _url, _params, ctx) => handleGetHousehold(ctx),
      PATCH: (req, _url, _params, ctx) => handlePatchHousehold(req, ctx),
    },
  },
  {
    pattern: '/api/household/members',
    methods: {
      GET: (_req, _url, _params, ctx) => handleGetHouseholdMembers(ctx),
    },
  },
  {
    pattern: '/api/household/invitations',
    methods: {
      POST: (req, _url, _params, ctx) => handlePostHouseholdInvitation(req, ctx),
    },
  },
  {
    pattern: '/api/ingredients',
    methods: {
      GET: (_req, url, _params, ctx) => handleListIngredients(url, ctx),
      POST: (req, _url, _params, ctx) => handlePostIngredient(req, ctx),
    },
  },
  {
    pattern: '/api/ingredients/:ingredientId',
    methods: {
      GET: (_req, _url, params, ctx) => handleGetIngredient(params.ingredientId!, ctx),
      PATCH: (req, _url, params, ctx) => handlePatchIngredient(params.ingredientId!, req, ctx),
      DELETE: (_req, _url, params, ctx) => handleDeleteIngredient(params.ingredientId!, ctx),
    },
  },
  {
    pattern: '/api/meals',
    methods: {
      GET: (_req, url, _params, ctx) => listMeals(url, ctx),
      POST: (req, _url, _params, ctx) => createMeal(req, ctx),
    },
  },
  {
    pattern: '/api/meals/random',
    methods: {
      GET: (_req, url, _params, ctx) => randomMeal(url, ctx),
    },
  },
  {
    pattern: '/api/meals/:mealId',
    methods: {
      GET: (_req, _url, params, ctx) => getMeal(params.mealId!, ctx),
      PATCH: (req, _url, params, ctx) => updateMeal(params.mealId!, req, ctx),
      DELETE: (_req, _url, params, ctx) => deleteMeal(params.mealId!, ctx),
    },
  },
  {
    pattern: '/api/day-plans',
    methods: {
      GET: (_req, url, _params, ctx) => listDayPlans(url, ctx),
      POST: (req, _url, _params, ctx) => createDayPlan(req, ctx),
    },
  },
  {
    pattern: '/api/day-plans/bulk',
    methods: {
      POST: (req, _url, _params, ctx) => bulkUpsertDayPlans(req, ctx),
    },
  },
  {
    pattern: '/api/day-plans/:dayPlanId',
    methods: {
      GET: (_req, _url, params, ctx) => getDayPlan(params.dayPlanId!, ctx),
      PATCH: (req, _url, params, ctx) => patchDayPlan(params.dayPlanId!, req, ctx),
      DELETE: (_req, _url, params, ctx) => deleteDayPlan(params.dayPlanId!, ctx),
    },
  },
];

function segments(pathname: string): string[] {
  return pathname.replace(/\/+$/, '').split('/').filter(Boolean);
}

/** Match `segs` against a route pattern; `null` when it does not match. */
function matchRoute(route: RouteDef, segs: string[]): RouteParams | null {
  const parts = route.pattern.split('/').filter(Boolean);
  if (parts.length !== segs.length) return null;
  const params: RouteParams = {};
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]!;
    const seg = segs[i]!;
    if (part.startsWith(':')) {
      if (!isUuid(seg)) return null;
      params[part.slice(1)] = seg;
    } else if (part !== seg) {
      return null;
    }
  }
  return params;
}

/** For 405 responses: allowed methods for this documented `/api/*` path, or `null` if unknown. */
export function apiAllowedMethodsForPathname(pathname: string): string[] | null {
  const segs = segments(pathname);
  for (const route of ROUTES) {
    if (matchRoute(route, segs) !== null) {
      return Object.keys(route.methods);
    }
  }
  return null;
}

/** Documented routes as OpenAPI-style paths (`:id` → `{id}`); consumed by the parity test. */
export function documentedApiRoutes(): { path: string; methods: string[] }[] {
  return ROUTES.map((route) => ({
    path: route.pattern.replace(/:(\w+)/g, '{$1}'),
    methods: Object.keys(route.methods),
  }));
}

/** Health check shared by `server.ts` (pre-auth) and the route table. */
export async function healthResponse(db: Pick<PrismaClient, '$connect'>): Promise<Response> {
  try {
    await db.$connect();
    return Response.json({ status: 'ok' }, { status: 200 });
  } catch {
    return Response.json({ status: 'error' }, { status: 503 });
  }
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
  for (const route of ROUTES) {
    const params = matchRoute(route, segs);
    if (params === null) continue;
    const handler = route.methods[req.method as HttpMethod];
    if (!handler) {
      // Documented path, wrong method: caller replies 405 with `Allow` from the table.
      return Promise.resolve(null);
    }
    return wrap(() => handler(req, url, params, ctx));
  }
  // Undocumented path: caller replies 404.
  return Promise.resolve(null);
}
