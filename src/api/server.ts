import type { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

import { resolveAuthUserId } from './auth';
import { jsonError } from './errors';
import { ApiProblem } from './api-problem';
import { getHouseholdForUser } from './services/tenancy';
import { apiAllowedMethodsForPathname, dispatchApi } from './router';

const PORT = Number(process.env.PORT) || 3000;

export type PrismaLike = { $connect(): Promise<void> };

export function createFetchHandler(db: PrismaClient) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') {
      if (req.method === 'GET') {
        try {
          await db.$connect();
          return Response.json({ status: 'ok' }, { status: 200 });
        } catch {
          return Response.json({ status: 'error' }, { status: 503 });
        }
      }
      return new Response(null, { status: 405, headers: { Allow: 'GET' } });
    }

    const auth = resolveAuthUserId(req);
    if (auth instanceof Response) return auth;

    try {
      const { householdId } = await getHouseholdForUser(db, auth);
      const ctx = { prisma: db, userId: auth, householdId };
      const out = await dispatchApi(req, db, ctx);
      if (out === null) {
        const allow = apiAllowedMethodsForPathname(url.pathname);
        if (allow !== null && !allow.includes(req.method)) {
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
  Bun.serve({
    port: PORT,
    fetch: createFetchHandler(prisma),
  });
}
