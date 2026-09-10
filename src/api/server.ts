import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

import { resolveAuthUserId } from './auth';
import { jsonError } from './errors';
import { ApiProblem } from './api-problem';
import { getHouseholdForUser } from './services/tenancy';
import { apiAllowedMethodsForPathname, dispatchApi, healthResponse } from './router';
import {
  assertJwtAccessConfigLoaded,
  assertJwtSecretMeetsMinUtf8LengthOrThrow,
  warnIfDevelopmentJwtSecretBelowMin,
} from './jwt-access';
import { handlePostLogin, handlePostLogout, handlePostRegister } from './handlers/auth';

const PORT = Number(process.env.PORT) || 3000;

export type PrismaLike = { $connect(): Promise<void> };

export function createFetchHandler(db: PrismaClient) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    if (path === '/api/health') {
      if (method === 'GET') {
        return await healthResponse(db);
      }
      const allow = apiAllowedMethodsForPathname(path)!;
      return new Response(null, { status: 405, headers: { Allow: allow.join(', ') } });
    }

    try {
      if (path === '/api/auth/register' && method === 'POST') {
        return await handlePostRegister(req, db);
      }
      if (path === '/api/auth/login' && method === 'POST') {
        return await handlePostLogin(req, db);
      }

      // Auth paths: reject wrong methods with 405 before authentication.
      if (path.startsWith('/api/auth/')) {
        const allow = apiAllowedMethodsForPathname(path);
        if (allow && !allow.includes(method)) {
          return new Response(null, { status: 405, headers: { Allow: allow.join(', ') } });
        }
      }

      const auth = await resolveAuthUserId(req);
      if (auth instanceof Response) return auth;

      if (path === '/api/auth/logout' && method === 'POST') {
        return await handlePostLogout(req);
      }

      const { householdId } = await getHouseholdForUser(db, auth);
      const ctx = { prisma: db, userId: auth, householdId };
      const out = await dispatchApi(req, db, ctx);
      if (out === null) {
        const allow = apiAllowedMethodsForPathname(path);
        if (allow !== null && !allow.includes(method)) {
          return new Response(null, { status: 405, headers: { Allow: allow.join(', ') } });
        }
        return new Response(null, { status: 404 });
      }
      return out;
    } catch (e) {
      if (e instanceof ApiProblem) {
        return jsonError(e.status, e.code, e.message);
      }
      throw e;
    }
  };
}

if (import.meta.main) {
  const authMode = process.env.AUTH_MODE ?? 'production';
  if (authMode !== 'development') {
    assertJwtAccessConfigLoaded();
    assertJwtSecretMeetsMinUtf8LengthOrThrow();
  } else {
    warnIfDevelopmentJwtSecretBelowMin();
  }
  Bun.serve({
    port: PORT,
    fetch: createFetchHandler(prisma),
  });
}
