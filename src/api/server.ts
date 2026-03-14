import { prisma } from '../lib/prisma';

const PORT = Number(process.env.PORT) || 3000;

export type PrismaLike = { $connect(): Promise<void> };

export function createFetchHandler(db: PrismaLike) {
  return async function handleRequest(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/api/health' && req.method === 'GET') {
      try {
        await db.$connect();
        return Response.json({ status: 'ok' }, { status: 200 });
      } catch {
        return Response.json({ status: 'error' }, { status: 503 });
      }
    }
    return new Response(null, { status: 404 });
  };
}

if (import.meta.main) {
  Bun.serve({
    port: PORT,
    fetch: createFetchHandler(prisma),
  });
}
