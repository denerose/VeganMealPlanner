import type { PrismaClient } from '@prisma/client';
import { ApiProblem } from '../api-problem';
import { readJsonBody, readJsonBodyOrEmpty } from '../parse';
import { login, register } from '../services/auth-service';

export async function handlePostRegister(req: Request, prisma: PrismaClient): Promise<Response> {
  const body = await readJsonBody<unknown>(req);
  const envelope = await register(prisma, body);
  return Response.json(envelope, { status: 201 });
}

export async function handlePostLogin(req: Request, prisma: PrismaClient): Promise<Response> {
  const body = await readJsonBody<unknown>(req);
  const envelope = await login(prisma, body);
  return Response.json(envelope, { status: 200 });
}

/**
 * Logout: validates the (empty or `{}`) body, then bumps the user's `tokensValidAfter` revocation
 * epoch to now — revoking ALL of that user's outstanding access tokens — and returns 204.
 */
export async function handlePostLogout(
  req: Request,
  db: PrismaClient,
  userId: string
): Promise<Response> {
  const body = await readJsonBodyOrEmpty(req);
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_body', 'Logout body must be a JSON object or empty');
  }
  if (Object.keys(body).length > 0) {
    throw new ApiProblem(422, 'invalid_body', 'Logout body must be empty or {}');
  }
  await db.user.update({ where: { id: userId }, data: { tokensValidAfter: new Date() } });
  return new Response(null, { status: 204 });
}
